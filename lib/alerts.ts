import { getPnlAlertState, getSettings, getWatchlist, setPnlAlertState } from "./kv";
import { isTradingSession, vnTimeLabel } from "./market";
import { comparableBuyPrice } from "./pnl";
import type { Quote } from "./types";
import { sendTelegramMessage } from "./telegram";

const THRESHOLD_PCT = 5;

function vnDayKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function directionFromPnlPct(pnlPct: number): "up" | "down" | null {
  if (pnlPct >= THRESHOLD_PCT) return "up";
  if (pnlPct <= -THRESHOLD_PCT) return "down";
  return null;
}

export async function maybeSendPnlSpikeAlert(symbol: string, quote: Quote) {
  if (!isTradingSession()) return;

  const settings = await getSettings();
  const token = settings.telegram_bot_token.trim();
  const chatId = settings.telegram_chat_id.trim();
  if (!token || !chatId) return;

  const list = await getWatchlist();
  const sym = symbol.toUpperCase().trim();
  const item = list.find((x) => x.symbol.toUpperCase() === sym);
  const buyPrice = item?.buy_price;
  if (!item || !Number.isFinite(buyPrice) || !buyPrice || buyPrice <= 0) return;

  const normalizedBuy = comparableBuyPrice(buyPrice, quote.price);
  const pnlPct = ((quote.price - normalizedBuy) / normalizedBuy) * 100;
  const direction = directionFromPnlPct(pnlPct);
  const day = vnDayKey();

  const prev = await getPnlAlertState(sym);
  if (!direction) {
    if (!prev || prev.day !== day || prev.direction !== null) {
      await setPnlAlertState(sym, { day, direction: null });
    }
    return;
  }

  if (prev && prev.day === day && prev.direction === direction) return;

  const sign = pnlPct >= 0 ? "+" : "";
  const change = quote.price - normalizedBuy;
  const dot = direction === "up" ? "🟢" : "🔴";
  const trend = direction === "up" ? "📈 TĂNG MẠNH" : "📉 GIẢM MẠNH";
  const pnlLabel = direction === "up" ? "Lãi" : "Lỗ";
  const text = [
    `🚨 <b>${trend}</b> (>= ${THRESHOLD_PCT}%)`,
    "",
    `${dot} <b>${escapeHtml(sym)}</b> - ${escapeHtml(item.display_name)}`,
    `💹 Giá TT: <code>${quote.price.toLocaleString("vi-VN")}</code> | KL: <b>${quote.volume.toLocaleString("vi-VN")}</b>`,
    `💰 Giá mua: <code>${normalizedBuy.toLocaleString("vi-VN")}</code>`,
    `📊 ${pnlLabel}: <b>${sign}${change.toLocaleString("vi-VN")} (${sign}${pnlPct.toFixed(2)}%)</b>`,
    "",
    `🕐 ${escapeHtml(vnTimeLabel())}`,
  ].join("\n");

  await sendTelegramMessage(token, chatId, text);
  await setPnlAlertState(sym, { day, direction });
}
