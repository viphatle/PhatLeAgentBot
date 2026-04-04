import { getScheduleEvents, getSettings, setScheduleEvents } from "./kv";
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
  const text = [
    "🗓️ <b>Đã tạo ghi chú lịch mới</b>",
    "",
    `⏰ <b>${escapeHtml(eventLine(e))}</b>`,
    `📝 GHI CHÚ: ${escapeHtml(e.note)}`,
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
    const startMs = eventEpochMs(e.date, e.time);
    const msToStart = startMs - nowMs;
    if (msToStart <= 0) continue;

    if (!e.remind_1d_sent_at && msToStart <= 24 * 60 * 60 * 1000) {
      const text = [
        "⏳ <b>Nhắc lịch: còn khoảng 1 ngày</b>",
        "",
        `⏰ <b>${escapeHtml(eventLine(e))}</b>`,
        `📝 GHI CHÚ: ${escapeHtml(e.note)}`,
      ].join("\n");
      await sendTelegramMessage(auth.token, auth.chatId, text);
      e.remind_1d_sent_at = new Date().toISOString();
      sent += 1;
      changed = true;
    }

    if (!e.remind_1h_sent_at && msToStart <= 60 * 60 * 1000) {
      const text = [
        "🔔 <b>Nhắc lịch: còn khoảng 1 giờ</b>",
        "",
        `⏰ <b>${escapeHtml(eventLine(e))}</b>`,
        `📝 GHI CHÚ: ${escapeHtml(e.note)}`,
      ].join("\n");
      await sendTelegramMessage(auth.token, auth.chatId, text);
      e.remind_1h_sent_at = new Date().toISOString();
      sent += 1;
      changed = true;
    }
  }

  if (changed) {
    await setScheduleEvents(events);
  }
  return { ok: true as const, sent };
}
