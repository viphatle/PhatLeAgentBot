import { getSettings, getWatchlist } from "./kv";
import { isTradingSession, vnTimeLabel } from "./market";
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
    rows.push({
      symbol: q.symbol,
      display_name: w.display_name,
      price: q.price,
      change: q.change,
      change_pct: q.change_pct,
      volume: q.volume,
      source: q.source,
    });
  }
  const text = formatDigest(rows, opts.sessionLabel, vnTimeLabel());
  await sendTelegramMessage(token, chatId, text);
  return { ok: true as const };
}
