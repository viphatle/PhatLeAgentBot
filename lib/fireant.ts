import type { Quote } from "./types";

const FIREANT_BASE = "https://www.fireant.vn/api";

function parseFireantQuote(data: unknown, sym: string): Quote | null {
  const root = data as {
    symbol?: string;
    price?: number;
    change?: number;
    percentChange?: number;
    totalVolume?: number;
    referencePrice?: number;
    lastPrice?: number;
    matchPrice?: number;
    close?: number;
    // Alternative field names from FireAnt
    r?: number; // reference
    c?: number; // change
    pc?: number; // percent change
    v?: number; // volume
    p?: number; // price
  } | null;

  if (!root) return null;

  const symbol = String(root.symbol ?? "").toUpperCase().trim();
  if (symbol && symbol !== sym) return null;

  // Try multiple field names that FireAnt might use
  const price = Number(root.price ?? root.p ?? root.lastPrice ?? root.matchPrice ?? root.close ?? 0);
  const change = Number(root.change ?? root.c ?? 0);
  const change_pct = Number(root.percentChange ?? root.pc ?? 0);
  const volume = Number(root.totalVolume ?? root.v ?? 0);
  const reference = Number(root.referencePrice ?? root.r ?? (price - change));

  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    symbol: sym,
    price: Math.round(price),
    reference: Number.isFinite(reference) && reference > 0 ? Math.round(reference) : Math.round(price - change),
    change: Number.isFinite(change) ? change : 0,
    change_pct: Number.isFinite(change_pct) ? change_pct : 0,
    volume: Number.isFinite(volume) ? Math.round(volume) : 0,
    source: "fireant",
  };
}

export async function fetchQuoteFromFireant(symbol: string): Promise<Quote | null> {
  const sym = symbol.toUpperCase().trim();
  if (!sym) return null;

  // Try multiple FireAnt endpoints
  const endpoints = [
    // Stock price endpoint
    `${FIREANT_BASE}/data/market/price?symbol=${encodeURIComponent(sym)}`,
    // Company data
    `${FIREANT_BASE}/data/company/${encodeURIComponent(sym)}/price`,
    // Market watch
    `${FIREANT_BASE}/data/market-watch/stock/${encodeURIComponent(sym)}`,
  ];

  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://www.fireant.vn/",
        },
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(4_000),
      });

      if (!r.ok) continue;

      const data = await r.json();
      const q = parseFireantQuote(data, sym);
      if (q) return q;

      // Try if data is nested in a data property
      if (data && typeof data === "object" && "data" in data) {
        const nested = parseFireantQuote(data.data, sym);
        if (nested) return nested;
      }
    } catch {
      continue;
    }
  }

  return null;
}
