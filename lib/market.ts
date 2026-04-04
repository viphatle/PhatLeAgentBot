const DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function vnParts(now: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = f.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    day: DOW[get("weekday")] ?? 0,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

/** HOSE/HNX phiên: T2–T6, 9:00–11:30 và 13:00–14:45 (GMT+7) */
export function isTradingSession(now = new Date()): boolean {
  const { day, hour, minute } = vnParts(now);
  if (day === 0 || day === 6) return false;
  const t = hour * 60 + minute;
  const morning = t >= 9 * 60 && t <= 11 * 60 + 30;
  const afternoon = t >= 13 * 60 && t <= 14 * 60 + 45;
  return morning || afternoon;
}

export function vnTimeLabel(now = new Date()) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(now);
}

/** Ngày giao dịch gần nhất (T2-T6) theo múi giờ Việt Nam */
export function latestTradingDayLabel(now = new Date()) {
  const { day } = vnParts(now);
  const backDays = day === 6 ? 1 : day === 0 ? 2 : 0;
  const ref = new Date(now.getTime() - backDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
  }).format(ref);
}
