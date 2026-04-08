import type { Quote } from "./types";

const CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

/** Yahoo dùng hậu tố .VN cho phần lớn cổ phiếu niêm yết tại Việt Nam (HOSE/HNX/UPCOM trên Yahoo). */
const YAHOO_SUFFIXES = [".VN", ".HNO"] as const;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type YahooCompanyInfo = {
  display_name: string;
  short_name?: string;
  exchange?: string;
  full_exchange?: string;
  currency?: string;
  yahoo_symbol: string;
};

function num(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

async function yahooChartFetch(yahooId: string): Promise<unknown | null> {
  // Use 1m interval with 1d range for more accurate real-time data
  // Include pre/post market data to get latest available price
  const url = `${CHART}/${encodeURIComponent(yahooId)}?interval=1m&range=1d&includePrePost=true`;
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(6_000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export function parseCompanyFromChart(data: unknown, requestedSymbol: string): YahooCompanyInfo | null {
  const root = data as {
    chart?: { result?: Array<{ meta?: Record<string, unknown> }> };
  };
  const meta = root.chart?.result?.[0]?.meta;
  if (!meta) return null;

  const sym = requestedSymbol.toUpperCase().trim();
  const longName = typeof meta.longName === "string" ? meta.longName.trim() : "";
  const shortName = typeof meta.shortName === "string" ? meta.shortName.trim() : "";
  const display_name = longName || shortName || sym;
  const yahooSym = typeof meta.symbol === "string" ? meta.symbol.trim() : "";

  return {
    display_name,
    short_name: shortName || undefined,
    exchange: typeof meta.exchangeName === "string" ? meta.exchangeName : undefined,
    full_exchange: typeof meta.fullExchangeName === "string" ? meta.fullExchangeName : undefined,
    currency: typeof meta.currency === "string" ? meta.currency : undefined,
    yahoo_symbol: yahooSym,
  };
}

/** Tra cứu tên công ty + sàn từ Yahoo (cùng API chart). */
export async function resolveYahooInstrument(symbol: string): Promise<YahooCompanyInfo | null> {
  const sym = symbol.toUpperCase().trim();
  if (!sym) return null;

  for (const suf of YAHOO_SUFFIXES) {
    const id = `${sym}${suf}`;
    const data = await yahooChartFetch(id);
    if (!data) continue;
    const c = parseCompanyFromChart(data, sym);
    if (c) {
      return {
        ...c,
        yahoo_symbol: c.yahoo_symbol || id,
      };
    }
  }
  return null;
}

function parseChartPayload(payload: unknown, requestedSymbol: string): Quote | null {
  const root = payload as {
    chart?: { result?: Array<Record<string, unknown>>; error?: unknown };
  };
  const result = root.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta as Record<string, unknown> | undefined;
  if (!meta) return null;

  let price = num(meta.regularMarketPrice);
  let reference = num(meta.chartPreviousClose);
  if (!Number.isFinite(reference) || reference <= 0) {
    reference = num(meta.previousClose);
  }

  const vol = Math.round(num(meta.regularMarketVolume));

  if (!Number.isFinite(price) || price <= 0) {
    const quotes = (result.indicators as Record<string, unknown> | undefined)?.quote as
      | Array<{ close?: (number | null)[] }>
      | undefined;
    const closes = quotes?.[0]?.close?.filter((x): x is number => typeof x === "number" && x > 0);
    if (closes?.length) price = closes[closes.length - 1]!;
  }

  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(reference) || reference <= 0) reference = price;

  const change = price - reference;
  const outSym = requestedSymbol.toUpperCase().trim();

  return {
    symbol: outSym,
    price,
    reference,
    change,
    change_pct: reference ? (change / reference) * 100 : 0,
    volume: Number.isFinite(vol) && vol >= 0 ? vol : 0,
    source: "yahoo",
  };
}

export async function fetchQuoteFromYahoo(symbol: string): Promise<Quote | null> {
  const sym = symbol.toUpperCase().trim();
  if (!sym) return null;

  for (const suf of YAHOO_SUFFIXES) {
    const data = await yahooChartFetch(`${sym}${suf}`);
    if (!data) continue;
    const q = parseChartPayload(data, sym);
    if (q) return q;
  }
  return null;
}
