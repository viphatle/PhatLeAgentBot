import type { Quote } from "./types";
import { fetchQuoteFromTcbs } from "./tcbs";
import { fetchQuoteFromYahoo } from "./yahoo";

const VNDIRECT = "https://finfo-api.vndirect.com.vn/v4/stock-prices";

function hashSeed(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mockQuote(symbol: string, kind: "demo" | "fallback"): Quote {
  const sym = symbol.toUpperCase().trim();
  const seed = hashSeed(sym);
  const base = 10_000 + (seed % 90_000);
  const deltaPct = ((seed % 500) / 100 - 2.5) * 0.4;
  const price = Math.round(base * (1 + deltaPct / 100));
  const ref = Math.round(price / (1 + deltaPct / 100));
  const change = price - ref;
  return {
    symbol: sym,
    price,
    reference: ref,
    change,
    change_pct: ref ? (change / ref) * 100 : 0,
    volume: 100_000 + (seed % 4_900_000),
    source: kind === "demo" ? "mock_demo" : "mock_fallback",
  };
}

function numFromRow(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

function parseVndirect(sym: string, payload: unknown): Quote | null {
  let rows: unknown[] = [];
  if (Array.isArray(payload)) rows = payload;
  else if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const inner = p.data ?? p.stockPrices ?? p.items;
    if (Array.isArray(inner)) rows = inner;
  }
  let row: Record<string, unknown> | null = null;
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const code = String(o.symbol ?? o.code ?? o.ticker ?? "").toUpperCase();
    if (code === sym) {
      row = o;
      break;
    }
  }
  if (!row && rows[0] && typeof rows[0] === "object") row = rows[0] as Record<string, unknown>;
  if (!row) return null;

  const price = numFromRow(row, ["lastPrice", "matchPrice", "price", "ceilingPrice"]);
  const ref = numFromRow(row, ["refPrice", "referencePrice", "basicPrice", "priorClose"]);
  const vol = numFromRow(row, ["totalVolume", "volume", "lot"]);
  if (!Number.isFinite(price) || price <= 0) return null;
  const reference = Number.isFinite(ref) && ref > 0 ? ref : price;
  const change = price - reference;
  return {
    symbol: sym,
    price,
    reference,
    change,
    change_pct: reference ? (change / reference) * 100 : 0,
    volume: Number.isFinite(vol) ? Math.round(vol) : 0,
    source: "vndirect",
  };
}

async function fetchQuoteFromVndirect(symbol: string): Promise<Quote | null> {
  const sym = symbol.toUpperCase().trim();
  try {
    const r = await fetch(`${VNDIRECT}?symbols=${encodeURIComponent(sym)}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Origin: "https://online.vndirect.com.vn",
        Referer: "https://online.vndirect.com.vn/",
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return parseVndirect(sym, data);
  } catch {
    return null;
  }
}

export async function fetchQuote(symbol: string, opts: { mock: boolean }): Promise<Quote> {
  const sym = symbol.toUpperCase().trim();
  if (!sym || sym.length > 20) throw new Error("Mã không hợp lệ");
  if (opts.mock) return mockQuote(sym, "demo");

  const yahoo = await fetchQuoteFromYahoo(sym);
  if (yahoo) return yahoo;

  const tcbs = await fetchQuoteFromTcbs(sym);
  if (tcbs) return tcbs;

  const vn = await fetchQuoteFromVndirect(sym);
  if (vn) return vn;

  return mockQuote(sym, "fallback");
}
