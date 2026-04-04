import { getSettings, getWatchlist } from "./kv";
import { isTradingSession, latestTradingDayLabel, vnTimeLabel } from "./market";
import { comparableBuyPrice } from "./pnl";
import { fetchQuote } from "./prices";
import { formatDigest, sendTelegramMessage } from "./telegram";

export async function sendStockDigest(opts: {
  force?: boolean;
  sessionLabel: string;
}) {
  const settings = await getSettings();
  const token = settings.telegram_bot_token.trim();
  const chatId = settings.telegram_chat_id.trim();
  if (!token && !chatId) {
    return { ok: false as const, reason: "missing_token_and_chat" as const };
  }
  if (!token) {
    return { ok: false as const, reason: "missing_token" as const };
  }
  if (!chatId) {
    return { ok: false as const, reason: "missing_chat_id" as const };
  }
  if (!opts.force && !isTradingSession()) {
    return { ok: false as const, reason: "outside_session" as const };
  }
  const list = await getWatchlist();
  if (!list.length) {
    return { ok: false as const, reason: "empty_watchlist" as const };
  }
  const rows = [];
  for (const w of list) {
    const q = await fetchQuote(w.symbol, { mock: settings.mock_prices });
    const buyPrice =
      w.buy_price !== undefined && Number.isFinite(w.buy_price) && w.buy_price > 0
        ? comparableBuyPrice(w.buy_price, q.price)
        : undefined;
    const pnlValue = buyPrice !== undefined ? q.price - buyPrice : undefined;
    const pnlPct = buyPrice !== undefined && pnlValue !== undefined ? (pnlValue / buyPrice) * 100 : undefined;
    rows.push({
      symbol: q.symbol,
      display_name: w.display_name,
      price: q.price,
      change: q.change,
      change_pct: q.change_pct,
      volume: q.volume,
      buy_price: buyPrice,
      pnl_value: pnlValue,
      pnl_pct: pnlPct,
      source: q.source,
    });
  }
  const session = `Phiên ${latestTradingDayLabel()} (${opts.sessionLabel})`;
  const text = formatDigest(rows, session, vnTimeLabel());
  await sendTelegramMessage(token, chatId, text);
  return { ok: true as const };
}
