import type { Quote } from "./types";
import { fetchQuoteFromTcbs } from "./tcbs";
import { fetchQuoteFromFireant } from "./fireant";

const VNDIRECT = "https://finfo-api.vndirect.com.vn/v4/stock-prices";
const VNDIRECT_HISTORY = "https://api-finfo.vndirect.com.vn/v4/stock_prices";

function hashSeed(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mockQuote(symbol: string): Quote {
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
    source: "mock_demo",
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

// VNDIRECT đôi khi trả giá theo đơn vị "nghìn đồng" (vd 23.1) thay vì VND (23100).
// Chuẩn hoá về VND để đồng nhất với Yahoo/TCBS và UI.
function normalizeToVndUnit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return value;
  if (value < 1000) return Math.round(value * 1000);
  return value;
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

  const price = normalizeToVndUnit(numFromRow(row, ["lastPrice", "matchPrice", "price", "ceilingPrice"]));
  const ref = normalizeToVndUnit(numFromRow(row, ["refPrice", "referencePrice", "basicPrice", "priorClose"]));
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
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return parseVndirect(sym, data);
  } catch {
    return null;
  }
}

function parseVndirectHistory(sym: string, payload: unknown): Quote | null {
  const root = payload as {
    data?: Array<Record<string, unknown>>;
  };
  const row = root.data?.[0];
  if (!row || typeof row !== "object") return null;

  const code = String(row.code ?? "").toUpperCase();
  if (code && code !== sym) return null;

  const price = normalizeToVndUnit(numFromRow(row, ["close", "adClose", "average"]));
  const reference = normalizeToVndUnit(numFromRow(row, ["basicPrice", "adOpen", "open", "close"]));
  const volume = numFromRow(row, ["nmVolume", "volume"]);

  if (!Number.isFinite(price) || price <= 0) return null;
  const ref = Number.isFinite(reference) && reference > 0 ? reference : price;
  const change = price - ref;
  const changePctRaw = numFromRow(row, ["pctChange"]);
  const change_pct = Number.isFinite(changePctRaw) ? changePctRaw : ref ? (change / ref) * 100 : 0;

  return {
    symbol: sym,
    price,
    reference: ref,
    change,
    change_pct,
    volume: Number.isFinite(volume) ? Math.round(volume) : 0,
    source: "vndirect",
  };
}

async function fetchQuoteFromVndirectHistory(symbol: string): Promise<Quote | null> {
  const sym = symbol.toUpperCase().trim();
  try {
    const r = await fetch(
      `${VNDIRECT_HISTORY}?sort=date:desc&size=1&q=${encodeURIComponent(`code:${sym}`)}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!r.ok) return null;
    const data = await r.json();
    return parseVndirectHistory(sym, data);
  } catch {
    return null;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// UPCOM stocks often need special handling
const UPCOM_FALLBACK_SOURCES = [
  // Some UPCOM stocks are tracked on specific endpoints
  "https://api-finfo.vndirect.com.vn/v4/stock_prices",
];

export async function fetchQuote(symbol: string, opts: { mock: boolean }): Promise<Quote | null> {
  const sym = symbol.toUpperCase().trim();
  if (!sym || sym.length > 20) throw new Error("Mã không hợp lệ");
  if (opts.mock) return mockQuote(sym);

  // UPCOM stocks: try VNDirect first (they have better UPCOM coverage)
  const isUpcomGuess = sym.length >= 4; // UPCOM symbols tend to be longer
  
  if (isUpcomGuess) {
    // For UPCOM-like symbols, prioritize VNDirect APIs
    const [vndirectRt, vnHistory] = await Promise.all([
      withTimeout(fetchQuoteFromVndirect(sym), 3_000),
      withTimeout(fetchQuoteFromVndirectHistory(sym), 2_500),
    ]);
    if (vndirectRt) {
      console.log(`[${sym}] Price from VNDirect RT (UPCOM priority)`);
      return vndirectRt;
    }
    if (vnHistory) {
      console.log(`[${sym}] Price from VNDirect History (UPCOM fallback)`);
      return vnHistory;
    }
  }

  // Standard flow for HOSE/HNX
  // 1. FireAnt (real-time WebSocket/API) - timeout 2.5s
  // 2. TCBS (real-time) - timeout 1.5s  
  // 3. VNDirect real-time API - timeout 2s
  const [fireant, tcbs, vndirectRt] = await Promise.all([
    withTimeout(fetchQuoteFromFireant(sym), 2_500),
    withTimeout(fetchQuoteFromTcbs(sym), 1_500),
    withTimeout(fetchQuoteFromVndirect(sym), 2_000),
  ]);
  
  if (fireant) {
    console.log(`[${sym}] Price from FireAnt`);
    return fireant;
  }
  if (tcbs) {
    console.log(`[${sym}] Price from TCBS`);
    return tcbs;
  }
  if (vndirectRt) {
    console.log(`[${sym}] Price from VNDirect RT`);
    return vndirectRt;
  }

  // Final fallback: VNDirect history (có thể delay 15-30 phút)
  const vnHistory = await withTimeout(fetchQuoteFromVndirectHistory(sym), 1_800);
  if (vnHistory) {
    console.log(`[${sym}] Price from VNDirect History (final fallback)`);
    return vnHistory;
  }

  console.error(`[${sym}] Failed to fetch price from all sources`);
  return null;
}
