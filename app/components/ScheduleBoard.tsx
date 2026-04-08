"use client";

import type { ScheduleOccurrence } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { LogoutButton } from "./LogoutButton";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toDateKey(d: Date) {
  return `${toMonthKey(d)}-${String(d.getDate()).padStart(2, "0")}`;
}

function toViDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function monthStartGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - offset);
  return gridStart;
}

function formatTimeDisplay(time24: string) {
  const [h, m] = time24.split(":");
  return `${h}:${m}`;
}

function getEventTypeColor(note: string): string {
  const lower = note.toLowerCase();
  if (lower.includes("khẩn") || lower.includes("urgent")) return "bg-rose-500/20 border-rose-500/50 text-rose-300";
  if (lower.includes("quan trọng") || lower.includes("important")) return "bg-amber-500/20 border-amber-500/50 text-amber-300";
  if (lower.includes("họp") || lower.includes("meeting")) return "bg-blue-500/20 border-blue-500/50 text-blue-300";
  if (lower.includes("báo cáo") || lower.includes("report")) return "bg-emerald-500/20 border-emerald-500/50 text-emerald-300";
  return "bg-slate-700/50 border-slate-600 text-slate-300";
}

function getEventIcon(note: string): string {
  const lower = note.toLowerCase();
  if (lower.includes("khẩn")) return "🚨";
  if (lower.includes("họp")) return "📊";
  if (lower.includes("báo cáo")) return "📄";
  if (lower.includes("gọi") || lower.includes("liên hệ")) return "📞";
  if (lower.includes("gửi")) return "📤";
  if (lower.includes("nhận")) return "📥";
  return "📝";
}

export function ScheduleBoard({ embedded = false }: { embedded?: boolean }) {
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<ScheduleOccurrence[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => (embedded ? "" : toDateKey(new Date())));
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [repeatMode, setRepeatMode] = useState<"none" | "weekly" | "monthly">("none");
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([]);
  const [repeatMonthDay, setRepeatMonthDay] = useState(() => new Date().getDate());
  const [msg, setMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const monthKey = toMonthKey(month);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/schedule?month=${monthKey}`);
        if (!r.ok) return;
        const j = (await r.json()) as { events?: ScheduleOccurrence[] };
        setEvents(j.events ?? []);
      } catch {
        // Keep UI stable when API is temporarily unreachable.
      }
    })();
  }, [monthKey]);

  const days = useMemo(() => {
    const start = monthStartGrid(month);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const selectedEvents = useMemo(
    () =>
      events
        .filter((e) => Boolean(selectedDate) && e.date === selectedDate)
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)),
    [events, selectedDate],
  );

  const noteCountByDate = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of events) m[e.date] = (m[e.date] ?? 0) + 1;
    return m;
  }, [events]);

  // Stats for monitor display
  const todayKey = toDateKey(new Date());
  const todayCount = noteCountByDate[todayKey] ?? 0;
  const monthTotal = events.length;
  const upcomingEvents = events.filter(e => e.date >= todayKey).length;

  return (
    <main className={embedded ? "" : "min-h-screen bg-[#0a0f1a] p-4 md:p-6"}>
      {!embedded && (
        <header className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl font-mono">
                  SCHEDULE <span className="text-blue-500">MONITOR</span>
                </h1>
                <p className="text-sm text-slate-400">Hệ thống nhắc việc & theo dõi lịch trình</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href="/" className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-600 hover:text-white transition-colors">
                ← Dashboard
              </a>
              <a href="/settings" className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-600 hover:text-white transition-colors">
                ⚙️ Cài đặt
              </a>
              <LogoutButton />
            </div>
          </div>

          {/* Monitor Stats Bar */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Hôm nay</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-xl font-bold ${todayCount > 0 ? "text-blue-400" : "text-slate-400"}`}>{todayCount}</span>
                <span className="text-xs text-slate-500">công việc</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Sắp tới</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-emerald-400">{upcomingEvents}</span>
                <span className="text-xs text-slate-500">sự kiện</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Tháng này</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-200">{monthTotal}</span>
                <span className="text-xs text-slate-500">tổng</span>
              </div>
            </div>
          </div>
        </header>
      )}

      <div className={`grid gap-6 ${!embedded || selectedDate ? "lg:grid-cols-[3fr_2fr]" : "lg:grid-cols-1"}`}>
        {/* Calendar Monitor */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              >
                ←
              </button>
              <div className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/30">
                <span className="text-sm font-semibold text-white font-mono">
                  {month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" }).toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              >
                →
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setMonth(today);
                setSelectedDate(toDateKey(today));
              }}
              className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-sm text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
              Hôm nay
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 mb-2">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-2 border-b border-slate-800">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = toDateKey(d);
              const inMonth = d.getMonth() === month.getMonth();
              const active = key === selectedDate;
              const count = noteCountByDate[key] ?? 0;
              const hasNotes = count > 0;
              const isToday = key === todayKey;
              
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  className={`
                    relative rounded-lg border p-2 text-sm transition-all
                    ${active
                      ? "border-blue-500 bg-blue-500/20 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                      : hasNotes
                        ? "border-emerald-500/50 bg-emerald-500/10 text-slate-200 hover:bg-emerald-500/20"
                        : "border-slate-700/50 bg-slate-800/20 text-slate-400 hover:bg-slate-800/40 hover:border-slate-600"
                    }
                    ${inMonth ? "" : "opacity-30"}
                    ${isToday && !active ? "ring-1 ring-blue-400/50" : ""}
                  `}
                >
                  <div className={`font-mono ${isToday ? "text-blue-400 font-bold" : ""}`}>
                    {String(d.getDate()).padStart(2, "0")}
                  </div>
                  {hasNotes && (
                    <div className="mt-1 flex items-center justify-center gap-0.5">
                      {count <= 3 ? (
                        Array.from({ length: count }).map((_, i) => (
                          <span key={i} className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        ))
                      ) : (
                        <span className="text-[9px] text-emerald-400 font-bold">{count}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {(!embedded || selectedDate) && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">TASK ENTRY</h2>
                  <p className="text-xs text-slate-500 font-mono">{toViDate(selectedDate)}</p>
                </div>
              </div>
              {selectedEvents.length > 0 && (
                <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                  {selectedEvents.length} công việc
                </span>
              )}
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Time Input */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 block">Thời gian</label>
                  <div className="relative">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">⏰</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 block">Lặp lại</label>
                  <select
                    value={repeatMode}
                    onChange={(e) => setRepeatMode(e.target.value as "none" | "weekly" | "monthly")}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors appearance-none cursor-pointer"
                  >
                    <option value="none">🚫 Không lặp</option>
                    <option value="weekly">📅 Hàng tuần</option>
                    <option value="monthly">📆 Hàng tháng</option>
                  </select>
                </div>
              </div>

              {/* Weekly Days Selector */}
              {repeatMode === "weekly" && (
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
                  <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">Chọn thứ</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { d: 1, t: "T2" },
                      { d: 2, t: "T3" },
                      { d: 3, t: "T4" },
                      { d: 4, t: "T5" },
                      { d: 5, t: "T6" },
                      { d: 6, t: "T7" },
                      { d: 0, t: "CN" },
                    ].map((x) => {
                      const active = repeatWeekdays.includes(x.d);
                      return (
                        <button
                          key={x.d}
                          type="button"
                          onClick={() =>
                            setRepeatWeekdays((prev) =>
                              prev.includes(x.d) ? prev.filter((v) => v !== x.d) : [...prev, x.d],
                            )
                          }
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                            active 
                              ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25" 
                              : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                          }`}
                        >
                          {x.t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Monthly Day */}
              {repeatMode === "monthly" && (
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
                  <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">Ngày trong tháng</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={repeatMonthDay}
                      onChange={(e) => setRepeatMonthDay(Number(e.target.value))}
                      className="w-24 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                    />
                    <span className="text-xs text-slate-500">hàng tháng</span>
                  </div>
                </div>
              )}

              {/* Note Input */}
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 block">Nội dung công việc</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nhập nội dung công việc cần thực hiện...&#10;💡 Gợi ý: thêm 'KHẨN' để đánh dấu ưu tiên cao"
                  className="w-full h-28 rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors resize-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="button"
                disabled={isSubmitting || !note.trim()}
                onClick={async () => {
                  if (!note.trim()) return;
                  setIsSubmitting(true);
                  setMsg(null);
                  try {
                    const r = await fetch("/api/schedule", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        date: selectedDate,
                        time,
                        note: note.trim(),
                        recurrence: {
                          mode: repeatMode,
                          weekdays: repeatWeekdays,
                          month_day: repeatMonthDay,
                        },
                      }),
                    });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) {
                      setMsg(j?.error ?? "Không lưu được ghi chú");
                      return;
                    }
                    const rr = await fetch(`/api/schedule?month=${monthKey}`);
                    const jj = (await rr.json().catch(() => ({}))) as { events?: ScheduleOccurrence[] };
                    setEvents(jj.events ?? []);
                    setNote("");
                    setMsg("✅ Đã lưu và gửi thông báo Telegram");
                  } catch {
                    setMsg("❌ Không kết nối được máy chủ");
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Đang lưu...
                  </span>
                ) : (
                  "➕ Thêm công việc"
                )}
              </button>

              {msg && (
                <div className={`rounded-lg px-3 py-2 text-sm ${
                  msg.startsWith("✅") 
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" 
                    : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                }`}>
                  {msg}
                </div>
              )}
            </div>

            {/* Event List */}
            <div className="mt-6 border-t border-slate-800 pt-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Danh sách công việc
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedEvents.length === 0 ? (
                  <div className="text-center py-6 rounded-lg border border-dashed border-slate-700">
                    <span className="text-2xl mb-2 block">📭</span>
                    <p className="text-sm text-slate-500">Chưa có công việc nào</p>
                  </div>
                ) : (
                  selectedEvents.map((e) => (
                    <div 
                      key={e.id} 
                      className={`group rounded-lg border p-3 transition-all hover:scale-[1.02] ${getEventTypeColor(e.note)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getEventIcon(e.note)}</span>
                            <span className="text-sm font-semibold font-mono">{formatTimeDisplay(e.time)}</span>
                            {e.recurrence_text && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-700/50 text-[10px] text-slate-400">
                                🔄 {e.recurrence_text}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm leading-relaxed">{e.note}</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const r = await fetch("/api/schedule", {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: e.id }),
                              });
                              if (!r.ok) return;
                              setEvents((prev) => prev.filter((x) => x.id !== e.id));
                            } catch {
                              setMsg("❌ Không kết nối được máy chủ");
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
