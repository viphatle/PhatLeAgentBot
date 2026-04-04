import type { Quote } from "./types";

const BASE = "https://apipubaws.tcbs.com.vn";

/** Các path TCBS hay thay đổi — thử lần lượt; 404 thì trả null để tầng trên fallback. */
const CANDIDATE_PATHS = (ticker: string) => [
  `/tcanalysis/v1/ticker/${ticker}/overview`,
  `/stock-insight/v1/stock/board-summary?ticker=${ticker}`,
  `/stock-insight/v1/stock/short-profile?ticker=${ticker}`,
];

function pickNum(obj: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = obj[k];
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    return n;
  }
  return NaN;
}

function normalizeTcbsPayload(data: unknown, sym: string): Quote | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const price =
    pickNum(o, ["price", "lastPrice", "matchPrice", "close", "last"]) ||
    (o.ticker as Record<string, unknown> | undefined
      ? pickNum(o.ticker as Record<string, unknown>, ["price", "lastPrice"])
      : NaN);
  const ref = pickNum(o, ["refPrice", "referencePrice", "basicPrice", "priorClose"]);
  const vol = pickNum(o, ["totalVolume", "volume", "lot"]);
  if (!Number.isFinite(price) || price <= 0) return null;
  const reference = Number.isFinite(ref) && ref > 0 ? ref : price;
  const change = price - reference;
  const change_pct = reference ? (change / reference) * 100 : 0;
  return {
    symbol: sym,
    price,
    reference,
    change,
    change_pct,
    volume: Number.isFinite(vol) ? Math.round(vol) : 0,
    source: "tcbs",
  };
}

export async function fetchQuoteFromTcbs(ticker: string): Promise<Quote | null> {
  const sym = ticker.toUpperCase().trim();
  if (!sym) return null;

  for (const path of CANDIDATE_PATHS(sym)) {
    try {
      const r = await fetch(`${BASE}${path}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; stock-tracker/1.0)",
        },
        next: { revalidate: 0 },
      });
      if (!r.ok) continue;
      const data = await r.json();
      if (
        data &&
        typeof data === "object" &&
        "status" in data &&
        (data as { status?: number }).status === 404
      )
        continue;
      const q = normalizeTcbsPayload(data, sym);
      if (q) return q;
    } catch {
      continue;
    }
  }
  return null;
}
