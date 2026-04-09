import { getPnlAlertState, getSettings, getWatchlist, setPnlAlertState } from "./kv";
import { isTradingSession, vnTimeLabel } from "./market";
import { comparableBuyPrice } from "./pnl";
import type { Quote } from "./types";
import { sendTelegramMessage } from "./telegram";

// Alert thresholds: Breakeven (0%), then every 10% loss increment
const ALERT_LEVELS = [0, -10, -20, -30, -40, -50] as const;
const LOSS_STEP = 10;

// ANTI-SPAM CONFIGURATION
const MIN_ALERT_INTERVAL_MINUTES = 120; // Minimum 2 hours between alerts for same stock
const MAX_ALERTS_PER_DAY = 3; // Maximum 3 alerts per stock per day
const QUIET_HOURS_START = 11; // 11:00 (lunch break start)
const QUIET_HOURS_END = 13;   // 13:00 (lunch break end)

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

// Check if current time is in quiet hours (lunch break)
function isQuietHours(): boolean {
  const now = new Date();
  const vnHour = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })).getHours();
  return vnHour >= QUIET_HOURS_START && vnHour < QUIET_HOURS_END;
}

/**
 * Determine which alert level the current PnL falls into
 * Returns the level value (0, -10, -20, etc.) or null if no alert needed
 */
function getAlertLevel(pnlPct: number): number | null {
  // Profit case: only alert at breakeven (0%) when crossing from negative to positive
  if (pnlPct >= 0) {
    // Only alert if within 0-5% range (breakeven zone)
    return pnlPct <= 5 ? 0 : null;
  }
  
  // Loss case: alert at each 10% loss level
  // Round down to nearest 10% (e.g., -15% → -20% level)
  const lossLevel = Math.floor(pnlPct / LOSS_STEP) * LOSS_STEP;
  return lossLevel <= -10 ? lossLevel : null;
}

export async function maybeSendPnlSpikeAlert(symbol: string, quote: Quote) {
  // Only alert during active trading hours (skip lunch break)
  if (!isTradingSession()) return;
  if (isQuietHours()) return; // Skip lunch break (11:00-13:00)

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
  const day = vnDayKey();
  const now = Date.now();

  // Get current alert level
  const alertLevel = getAlertLevel(pnlPct);
  if (alertLevel === null) return;  // No alert threshold reached

  // Check if we already sent alert for this level today
  const prev = await getPnlAlertState(sym);
  if (prev && prev.day === day && prev.alert_level === alertLevel) {
    return;  // Already sent for this level today
  }

  // ANTI-SPAM: Check minimum time interval between alerts
  if (prev && prev.day === day && prev.last_alert_time) {
    const minutesSinceLastAlert = (now - prev.last_alert_time) / (60 * 1000);
    if (minutesSinceLastAlert < MIN_ALERT_INTERVAL_MINUTES) {
      return; // Too soon since last alert
    }
  }

  // ANTI-SPAM: Check max alerts per day
  const dailyAlertCount = prev?.day === day ? (prev.daily_count || 0) : 0;
  if (dailyAlertCount >= MAX_ALERTS_PER_DAY) {
    return; // Max alerts reached for today
  }

  // Format alert message based on level
  const sign = pnlPct >= 0 ? "+" : "";
  const change = quote.price - normalizedBuy;
  
  let title: string;
  let dot: string;
  let pnlLabel: string;
  
  if (alertLevel === 0) {
    // Breakeven
    title = "🎯 HUỀ VỐN";
    dot = "�";
    pnlLabel = "Huề vốn";
  } else if (alertLevel > -20) {
    // Light loss (-10% to -19%)
    title = `📉 LỖ ${alertLevel}%`;
    dot = "🟠";
    pnlLabel = `Lỗ ${alertLevel}%`;
  } else if (alertLevel > -40) {
    // Medium loss (-20% to -39%)
    title = `📉 LỖ ${alertLevel}% - CẢNH BÁO`;
    dot = "🔴";
    pnlLabel = `Lỗ ${alertLevel}%`;
  } else {
    // Heavy loss (-40% or more)
    title = `🚨 LỖ ${alertLevel}% - NGUY HIỂM`;
    dot = "🚨";
    pnlLabel = `Lỗ nặng ${alertLevel}%`;
  }

  const text = [
    `<b>${title}</b>`,
    "",
    `${dot} <b>${escapeHtml(sym)}</b> - ${escapeHtml(item.display_name)}`,
    `💹 Giá TT: <code>${quote.price.toLocaleString("vi-VN")}</code> | KL: <b>${quote.volume.toLocaleString("vi-VN")}</b>`,
    `💰 Giá mua: <code>${normalizedBuy.toLocaleString("vi-VN")}</code>`,
    `📊 ${pnlLabel}: <b>${sign}${change.toLocaleString("vi-VN")} (${sign}${pnlPct.toFixed(2)}%)</b>`,
    "",
    `<i>Giới hạn: ${dailyAlertCount + 1}/${MAX_ALERTS_PER_DAY} lần/ngày • Tối thiểu ${MIN_ALERT_INTERVAL_MINUTES} phút giữa các cảnh báo</i>`,
    `🕐 ${escapeHtml(vnTimeLabel())}`,
  ].join("\n");

  await sendTelegramMessage(token, chatId, text);
  await setPnlAlertState(sym, { 
    day, 
    alert_level: alertLevel,
    last_alert_time: now,
    daily_count: dailyAlertCount + 1
  });
}
