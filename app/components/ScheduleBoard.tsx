"use client";

import { useEffect, useMemo, useState } from "react";

type NoteMap = Record<string, string>;

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toDateKey(d: Date) {
  return `${toMonthKey(d)}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [notes, setNotes] = useState<NoteMap>({});
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const monthKey = toMonthKey(month);

  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/schedule?month=${monthKey}`);
      if (!r.ok) return;
      const j = (await r.json()) as { notes?: NoteMap };
      setNotes(j.notes ?? {});
    })();
  }, [monthKey]);

  useEffect(() => {
    setNote(notes[selectedDate] ?? "");
  }, [selectedDate, notes]);

  const days = useMemo(() => {
    const start = monthStartGrid(month);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white md:text-3xl">Lịch Biểu Nhắc Việc</h1>
        <a
          href="/"
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-slate-200 hover:border-accent"
        >
          Về danh sách chứng khoán
        </a>
      </header>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-line bg-card/90 p-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              className="rounded-md border border-line px-3 py-1 text-sm"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            >
              Tháng trước
            </button>
            <div className="text-sm font-semibold text-slate-200">
              {month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}
            </div>
            <button
              type="button"
              className="rounded-md border border-line px-3 py-1 text-sm"
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
              const hasNote = Boolean(notes[key]);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  className={`rounded-md border px-2 py-2 text-sm ${
                    active
                      ? "border-accent bg-accent/20 text-white"
                      : "border-line bg-surface/60 text-slate-200"
                  } ${inMonth ? "" : "opacity-45"}`}
                >
                  <div>{d.getDate()}</div>
                  <div className="mt-1 text-[10px]">{hasNote ? "●" : ""}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-card/90 p-4">
          <h2 className="text-lg font-semibold text-white">Ghi chú ngày {selectedDate}</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhập nội dung cần nhắc..."
            className="mt-3 h-48 w-full rounded-lg border border-line bg-surface/80 p-3 text-sm text-slate-100 outline-none ring-accent focus:ring-2"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
              onClick={async () => {
                setMsg(null);
                const r = await fetch("/api/schedule", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ date: selectedDate, note }),
                });
                const j = await r.json().catch(() => ({}));
                if (!r.ok) {
                  setMsg(j?.error ?? "Không lưu được ghi chú");
                  return;
                }
                const next = (j?.notes ?? {}) as NoteMap;
                const filtered = Object.fromEntries(
                  Object.entries(next).filter(([k]) => k.startsWith(`${monthKey}-`)),
                );
                setNotes(filtered);
                setMsg("Đã lưu ghi chú");
              }}
            >
              Lưu ghi chú
            </button>
            <button
              type="button"
              className="rounded-lg border border-line px-4 py-2 text-sm"
              onClick={async () => {
                setNote("");
                const r = await fetch("/api/schedule", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ date: selectedDate, note: "" }),
                });
                if (!r.ok) return;
                setNotes((prev) => {
                  const copy = { ...prev };
                  delete copy[selectedDate];
                  return copy;
                });
                setMsg("Đã xoá ghi chú");
              }}
            >
              Xoá
            </button>
          </div>
          {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
        </section>
      </div>
    </main>
  );
}
