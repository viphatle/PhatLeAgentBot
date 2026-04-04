"use client";

import type { ScheduleOccurrence } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

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

export function ScheduleBoard() {
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<ScheduleOccurrence[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [repeatMode, setRepeatMode] = useState<"none" | "weekly" | "monthly">("none");
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([]);
  const [repeatMonthDay, setRepeatMonthDay] = useState(() => new Date().getDate());
  const [msg, setMsg] = useState<string | null>(null);

  const monthKey = toMonthKey(month);

  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/schedule?month=${monthKey}`);
      if (!r.ok) return;
      const j = (await r.json()) as { events?: ScheduleOccurrence[] };
      setEvents(j.events ?? []);
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
        .filter((e) => e.date === selectedDate)
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)),
    [events, selectedDate],
  );

  const noteCountByDate = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of events) m[e.date] = (m[e.date] ?? 0) + 1;
    return m;
  }, [events]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl">Lịch Biểu Nhắc Việc</h1>
        <a
          href="/"
          className="rounded-lg subtle-btn px-3 py-1.5 text-sm text-slate-100"
        >
          Quay trở lại trang chủ
        </a>
      </header>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl p-4 glass-card">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              className="rounded-md subtle-btn px-3 py-1 text-sm"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            >
              Tháng trước
            </button>
            <div className="text-sm font-semibold text-slate-200">
              {month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}
            </div>
            <button
              type="button"
              className="rounded-md subtle-btn px-3 py-1 text-sm"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            >
              Tháng sau
            </button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {days.map((d) => {
              const key = toDateKey(d);
              const inMonth = d.getMonth() === month.getMonth();
              const active = key === selectedDate;
              const count = noteCountByDate[key] ?? 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  className={`rounded-md border px-2 py-2 text-sm ${
                    active
                      ? "border-accent bg-accent/25 text-white"
                      : "border-line bg-surface/40 text-slate-200"
                  } ${inMonth ? "" : "opacity-45"}`}
                >
                  <div>{d.getDate()}</div>
                  <div className="mt-1 text-[10px]">{count > 0 ? `${count} ghi chú` : ""}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl p-4 glass-card">
          <h2 className="text-lg font-bold text-white">Ghi chú ngày {toViDate(selectedDate)}</h2>
          <div className="mt-3 grid gap-2">
            <label className="text-xs text-muted">Giờ</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="neo-input rounded-lg px-3 py-2 text-sm text-slate-100 outline-none"
            />
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="GHI CHÚ: nội dung cần nhắc..."
            className="neo-input mt-3 h-32 w-full rounded-lg p-3 text-sm text-slate-100 outline-none"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="brand-btn rounded-lg px-4 py-2 text-sm font-semibold text-white"
              onClick={async () => {
                setMsg(null);
                const r = await fetch("/api/schedule", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    date: selectedDate,
                    time,
                    note,
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
                setMsg("Đã lưu ghi chú và gửi thông báo Telegram.");
              }}
            >
              Tạo ghi chú
            </button>
          </div>
          <div className="mt-3 space-y-2 rounded-lg border border-line/70 bg-surface/30 p-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted">Lặp lại</div>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={repeatMode === "none"}
                  onChange={() => setRepeatMode("none")}
                />
                Không lặp
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={repeatMode === "weekly"}
                  onChange={() => setRepeatMode("weekly")}
                />
                Theo thứ hàng tuần
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={repeatMode === "monthly"}
                  onChange={() => setRepeatMode("monthly")}
                />
                Theo ngày hàng tháng
              </label>
            </div>
            {repeatMode === "weekly" && (
              <div className="flex flex-wrap gap-2">
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
                      className={`rounded-md px-2 py-1 text-xs ${
                        active ? "brand-btn text-white" : "subtle-btn text-slate-200"
                      }`}
                    >
                      {x.t}
                    </button>
                  );
                })}
              </div>
            )}
            {repeatMode === "monthly" && (
              <label className="flex items-center gap-2">
                <span className="text-xs text-muted">Ngày trong tháng</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={repeatMonthDay}
                  onChange={(e) => setRepeatMonthDay(Number(e.target.value))}
                  className="neo-input w-20 rounded px-2 py-1 text-sm"
                />
              </label>
            )}
          </div>
          {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}

          <div className="mt-4 space-y-2">
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted">Chưa có ghi chú cho ngày này.</p>
            ) : (
              selectedEvents.map((e) => (
                <div key={e.id} className="rounded-lg border border-line/70 bg-surface/50 p-2.5">
                  <div className="text-sm font-medium text-slate-100">{e.time}</div>
                  <div className="mt-1 text-xs text-slate-300">GHI CHÚ: {e.note}</div>
                  <div className="mt-1 text-[11px] text-muted">Lặp: {e.recurrence_text}</div>
                  <button
                    type="button"
                    className="mt-2 rounded subtle-btn px-2 py-1 text-xs text-slate-300 hover:text-down"
                    onClick={async () => {
                      const r = await fetch("/api/schedule", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: e.id }),
                      });
                      if (!r.ok) return;
                      setEvents((prev) => prev.filter((x) => x.id !== e.id));
                    }}
                  >
                    Xoá
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
