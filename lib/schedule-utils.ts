import type { ScheduleEvent, ScheduleOccurrence } from "./types";

const WEEKDAY_TEXT: Record<number, string> = {
  0: "CN",
  1: "T2",
  2: "T3",
  3: "T4",
  4: "T5",
  5: "T6",
  6: "T7",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseIsoDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function jsWeekdayOfIsoDate(date: string) {
  const { y, m, d } = parseIsoDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function vnTodayIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(date: string, n: number) {
  const { y, m, d } = parseIsoDate(date);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function recurrenceText(event: ScheduleEvent) {
  const mode = event.recurrence?.mode ?? "none";
  if (mode === "weekly") {
    const weekdays = [...(event.recurrence?.weekdays ?? [])].sort((a, b) => a - b);
    const text = weekdays.map((d) => WEEKDAY_TEXT[d] ?? "").filter(Boolean).join(", ");
    return text ? `Hàng tuần: ${text}` : "Hàng tuần";
  }
  if (mode === "monthly") {
    const md = event.recurrence?.month_day;
    return md ? `Hàng tháng: ngày ${md}` : "Hàng tháng";
  }
  return "Không lặp";
}

function matchesRecurrence(event: ScheduleEvent, date: string) {
  const mode = event.recurrence?.mode ?? "none";
  if (date < event.date) return false;
  if (mode === "none") return date === event.date;
  if (mode === "weekly") {
    const weekdays = event.recurrence?.weekdays ?? [];
    return weekdays.includes(jsWeekdayOfIsoDate(date));
  }
  if (mode === "monthly") {
    const md = event.recurrence?.month_day;
    if (!md) return false;
    const { d } = parseIsoDate(date);
    return d === md;
  }
  return false;
}

export function isIsoDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function isIsoMonth(v: string) {
  return /^\d{4}-\d{2}$/.test(v);
}

export function isHourMinute(v: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
}

export function toOccurrenceId(eventId: string, date: string, isRecurring: boolean) {
  return isRecurring ? `${eventId}@${date}` : eventId;
}

export function seriesIdFromOccurrenceId(id: string) {
  const i = id.indexOf("@");
  return i === -1 ? id : id.slice(0, i);
}

export function expandEventsByMonth(events: ScheduleEvent[], month: string): ScheduleOccurrence[] {
  const [ys, ms] = month.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const lastDay = daysInMonth(y, m);
  const out: ScheduleOccurrence[] = [];

  for (const e of events) {
    const mode = e.recurrence?.mode ?? "none";
    if (mode === "none") {
      if (e.date.startsWith(`${month}-`)) {
        out.push({
          id: e.id,
          series_id: e.id,
          date: e.date,
          time: e.time,
          note: e.note,
          recurrence_mode: "none",
          recurrence_text: recurrenceText(e),
        });
      }
      continue;
    }
    for (let day = 1; day <= lastDay; day++) {
      const date = `${month}-${pad(day)}`;
      if (!matchesRecurrence(e, date)) continue;
      out.push({
        id: toOccurrenceId(e.id, date, true),
        series_id: e.id,
        date,
        time: e.time,
        note: e.note,
        recurrence_mode: mode,
        recurrence_text: recurrenceText(e),
      });
    }
  }

  return out.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

export function upcomingOccurrencesInWindow(
  event: ScheduleEvent,
  now = new Date(),
  horizonDays = 35,
): Array<{ date: string; time: string }> {
  const today = vnTodayIso(now);
  const out: Array<{ date: string; time: string }> = [];
  for (let i = 0; i <= horizonDays; i++) {
    const date = addDays(today, i);
    if (!matchesRecurrence(event, date)) continue;
    out.push({ date, time: event.time });
  }
  return out;
}

