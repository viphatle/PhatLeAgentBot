import type { Quote } from "./types";

const FIREANT_BASE = "https://www.fireant.vn/api";

function parseFireantMarketData(data: unknown, sym: string): Quote | null {
  const root = data as {
    symbol?: string;
    price?: number;
    change?: number;
    percentChange?: number;
    totalVolume?: number;
    referencePrice?: number;
  } | null;

  if (!root) return null;

  const symbol = String(root.symbol ?? "").toUpperCase().trim();
  if (symbol !== sym) return null;

  const price = Number(root.price);
  const change = Number(root.change);
  const change_pct = Number(root.percentChange);
  const volume = Number(root.totalVolume);
  const reference = Number(root.referencePrice);

  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    symbol: sym,
    price: Math.round(price),
    reference: Number.isFinite(reference) && reference > 0 ? Math.round(reference) : price,
    change: Number.isFinite(change) ? change : 0,
    change_pct: Number.isFinite(change_pct) ? change_pct : 0,
    volume: Number.isFinite(volume) ? Math.round(volume) : 0,
    source: "fireant",
  };
}

export async function fetchQuoteFromFireant(symbol: string): Promise<Quote | null> {
  const sym = symbol.toUpperCase().trim();
  if (!sym) return null;

  try {
    // FireAnt Market Data API - real-time prices
    const url = `${FIREANT_BASE}/Data/Companies/MarketData?symbol=${encodeURIComponent(sym)}`;
    const r = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(5_000),
    });

    if (!r.ok) return null;
    const data = await r.json();
    return parseFireantMarketData(data, sym);
  } catch {
    return null;
  }
}

// Alternative: FireAnt watchlist endpoint (batch data for multiple symbols)
export async function fetchQuotesFromFireantBatch(symbols: string[]): Promise<Record<string, Quote>> {
  if (!symbols.length) return {};

  try {
    const url = `${FIREANT_BASE}/Data/Companies/MarketWatchlist`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({ symbols }),
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8_000),
    });

    if (!r.ok) return {};

    const data = await r.json() as Array<{
      symbol: string;
      price?: number;
      change?: number;
      percentChange?: number;
      totalVolume?: number;
      referencePrice?: number;
    }>;

    const result: Record<string, Quote> = {};
    for (const item of data) {
      const q = parseFireantMarketData(item, item.symbol.toUpperCase());
      if (q) result[q.symbol] = q;
    }
    return result;
  } catch {
    return {};
  }
}
