import { getScheduleEvents, getSettings, setScheduleEvents } from "./kv";
import { upcomingOccurrencesInWindow } from "./schedule-utils";
import type { ScheduleEvent } from "./types";
import { sendTelegramMessage } from "./telegram";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function eventEpochMs(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1, (hh || 0) - 7, mm || 0, 0, 0);
}

function vnDateDisplay(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function eventLine(e: ScheduleEvent) {
  return `${vnDateDisplay(e.date)} ${e.time}`;
}

async function telegramAuth() {
  const settings = await getSettings();
  const token = settings.telegram_bot_token.trim();
  const chatId = settings.telegram_chat_id.trim();
  if (!token || !chatId) return null;
  return { token, chatId };
}

export async function sendScheduleCreatedNotice(e: ScheduleEvent) {
  const auth = await telegramAuth();
  if (!auth) return;
  const recurrence = e.recurrence?.mode ?? "none";
  const recurrenceText =
    recurrence === "weekly"
      ? `Lặp hàng tuần (${(e.recurrence?.weekdays ?? []).join(", ")})`
      : recurrence === "monthly"
      ? `Lặp hàng tháng (ngày ${e.recurrence?.month_day ?? "-"})`
      : "Không lặp";
  const text = [
    "🗓️ <b>Đã tạo ghi chú lịch mới</b>",
    "",
    `⏰ <b>${escapeHtml(eventLine(e))}</b>`,
    `📝 GHI CHÚ: ${escapeHtml(e.note)}`,
    `🔁 ${escapeHtml(recurrenceText)}`,
  ].join("\n");
  await sendTelegramMessage(auth.token, auth.chatId, text);
}

export async function processScheduleReminders(now = new Date()) {
  const auth = await telegramAuth();
  if (!auth) return { ok: true as const, sent: 0 };

  const events = await getScheduleEvents();
  if (!events.length) return { ok: true as const, sent: 0 };

  const nowMs = now.getTime();
  let sent = 0;
  let changed = false;

  for (const e of events) {
    const occs = upcomingOccurrencesInWindow(e, now, 40);
    const sent1d = new Set(e.remind_1d_keys ?? []);
    const sent1h = new Set(e.remind_1h_keys ?? []);

    for (const occ of occs) {
      const startMs = eventEpochMs(occ.date, occ.time);
      const msToStart = startMs - nowMs;
      if (msToStart <= 0) continue;

      if (!sent1d.has(occ.date) && msToStart <= 24 * 60 * 60 * 1000) {
        const text = [
          "⏳ <b>Nhắc lịch: còn khoảng 1 ngày</b>",
          "",
          `⏰ <b>${escapeHtml(`${vnDateDisplay(occ.date)} ${occ.time}`)}</b>`,
          `📝 GHI CHÚ: ${escapeHtml(e.note)}`,
        ].join("\n");
        await sendTelegramMessage(auth.token, auth.chatId, text);
        sent1d.add(occ.date);
        sent += 1;
        changed = true;
      }

      if (!sent1h.has(occ.date) && msToStart <= 60 * 60 * 1000) {
        const text = [
          "🔔 <b>Nhắc lịch: còn khoảng 1 giờ</b>",
          "",
          `⏰ <b>${escapeHtml(`${vnDateDisplay(occ.date)} ${occ.time}`)}</b>`,
          `📝 GHI CHÚ: ${escapeHtml(e.note)}`,
        ].join("\n");
        await sendTelegramMessage(auth.token, auth.chatId, text);
        sent1h.add(occ.date);
        sent += 1;
        changed = true;
      }
    }

    if (changed) {
      e.remind_1d_keys = Array.from(sent1d).sort().slice(-120);
      e.remind_1h_keys = Array.from(sent1h).sort().slice(-120);
    }
  }

  if (changed) {
    await setScheduleEvents(events);
  }
  return { ok: true as const, sent };
}
