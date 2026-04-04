import type { Quote } from "./types";

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_SUFFIXES = [".VN", ".HNO"] as const;
const VNDIRECT_HISTORY = "https://api-finfo.vndirect.com.vn/v4/stock_prices";

export type HistoryPeriod = "week" | "month" | "quarter" | "year";

export type HistoryPoint = {
  date: string; // YYYY-MM-DD
  close: number;
  volume: number;
};

export type HistoryIndicators = {
  sma20: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi14: number | null;
  macd: number | null;
  signal9: number | null;
};

export type HistoryStats = {
  points: number;
  high: number;
  low: number;
  avg_close: number;
  total_volume: number;
  avg_volume: number;
  period_change_pct: number;
  volatility_pct: number;
};

export type Forecast = {
  next_session: number;
  horizon_end: number;
  horizon_sessions: number;
  slope_per_session: number;
  confidence: "low" | "medium" | "high";
};

export type HistoryResult = {
  symbol: string;
  period: HistoryPeriod;
  source: Quote["source"] | "vndirect_history";
  points: HistoryPoint[];
  stats: HistoryStats;
  indicators: HistoryIndicators;
  forecast: Forecast;
};

function toYmd(tsSeconds: number) {
  const vnTime = new Date(tsSeconds * 1000 + 7 * 60 * 60 * 1000);
  const y = vnTime.getUTCFullYear();
  const m = String(vnTime.getUTCMonth() + 1).padStart(2, "0");
  const d = String(vnTime.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toPeriodConfig(period: HistoryPeriod): {
  range: string;
  interval: string;
  horizonSessions: number;
} {
  switch (period) {
    case "week":
      return { range: "1mo", interval: "1d", horizonSessions: 5 };
    case "month":
      return { range: "3mo", interval: "1d", horizonSessions: 22 };
    case "quarter":
      return { range: "6mo", interval: "1d", horizonSessions: 66 };
    case "year":
    default:
      return { range: "1y", interval: "1d", horizonSessions: 252 };
  }
}

function parseYmdUtc(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function toYmdUtc(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function trimRecentPeriod(points: HistoryPoint[], period: HistoryPeriod) {
  if (points.length < 2) return points;
  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latestDate = parseYmdUtc(ordered[ordered.length - 1].date);
  const start = new Date(latestDate);
  if (period === "week") start.setUTCDate(start.getUTCDate() - 6);
  if (period === "month") start.setUTCMonth(start.getUTCMonth() - 1);
  if (period === "quarter") start.setUTCMonth(start.getUTCMonth() - 3);
  if (period === "year") start.setUTCFullYear(start.getUTCFullYear() - 1);
  const startYmd = toYmdUtc(start);
  const latestYmd = ordered[ordered.length - 1].date;
  const filtered = ordered.filter((p) => p.date >= startYmd && p.date <= latestYmd);
  if (filtered.length >= 2) return filtered;
  return ordered.slice(-Math.min(20, ordered.length));
}

function num(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeToVndUnit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return value;
  if (value < 1000) return Math.round(value * 1000);
  return value;
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const segment = values.slice(values.length - period);
  return segment.reduce((a, b) => a + b, 0) / period;
}

function emaSeries(values: number[], period: number): number[] {
  if (!values.length) return [];
  const alpha = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i += 1) {
    out.push(values[i] * alpha + out[i - 1] * (1 - alpha));
  }
  return out;
}

function rsi(values: number[], period: number): number | null {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d;
    else losses += Math.abs(d);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function computeStats(points: HistoryPoint[]): HistoryStats {
  const closes = points.map((p) => p.close);
  const volumes = points.map((p) => p.volume);
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;
  const totalVolume = volumes.reduce((a, b) => a + b, 0);
  const avgVolume = totalVolume / volumes.length;
  const first = closes[0];
  const last = closes[closes.length - 1];
  const periodChangePct = first > 0 ? ((last - first) / first) * 100 : 0;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    if (closes[i - 1] > 0) returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const volatilityPct = stdDev(returns) * Math.sqrt(252) * 100;
  return {
    points: points.length,
    high,
    low,
    avg_close: avgClose,
    total_volume: totalVolume,
    avg_volume: avgVolume,
    period_change_pct: periodChangePct,
    volatility_pct: volatilityPct,
  };
}

function computeIndicators(points: HistoryPoint[]): HistoryIndicators {
  const closes = points.map((p) => p.close);
  const sma20 = sma(closes, 20);
  const ema12Series = emaSeries(closes, 12);
  const ema26Series = emaSeries(closes, 26);
  const ema12 = ema12Series.length ? ema12Series[ema12Series.length - 1] : null;
  const ema26 = ema26Series.length ? ema26Series[ema26Series.length - 1] : null;
  const macdSeries: number[] = [];
  const len = Math.min(ema12Series.length, ema26Series.length);
  for (let i = 0; i < len; i += 1) macdSeries.push(ema12Series[i] - ema26Series[i]);
  const macd = macdSeries.length ? macdSeries[macdSeries.length - 1] : null;
  const signalSeries = emaSeries(macdSeries, 9);
  const signal9 = signalSeries.length ? signalSeries[signalSeries.length - 1] : null;
  const rsi14 = rsi(closes, 14);
  return { sma20, ema12, ema26, rsi14, macd, signal9 };
}

function computeForecast(points: HistoryPoint[], horizonSessions: number): Forecast {
  const closes = points.map((p) => p.close);
  const n = closes.length;
  const last = closes[n - 1];
  if (n < 3) {
    return {
      next_session: last,
      horizon_end: last,
      horizon_sessions: horizonSessions,
      slope_per_session: 0,
      confidence: "low",
    };
  }

  const start = Math.max(0, n - 30);
  const xs = Array.from({ length: n - start }, (_, i) => i);
  const ys = closes.slice(start);
  const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const yMean = ys.reduce((a, b) => a + b, 0) / ys.length;
  let cov = 0;
  let varX = 0;
  for (let i = 0; i < xs.length; i += 1) {
    cov += (xs[i] - xMean) * (ys[i] - yMean);
    varX += (xs[i] - xMean) ** 2;
  }
  const slope = varX > 0 ? cov / varX : 0;
  const next = Math.max(0, last + slope);
  const horizon = Math.max(0, last + slope * horizonSessions);

  const retStd = stdDev(
    ys.slice(1).map((v, i) => (ys[i] > 0 ? (v - ys[i]) / ys[i] : 0)),
  );
  const confidence: Forecast["confidence"] = retStd < 0.01 ? "high" : retStd < 0.02 ? "medium" : "low";

  return {
    next_session: next,
    horizon_end: horizon,
    horizon_sessions: horizonSessions,
    slope_per_session: slope,
    confidence,
  };
}

async function fetchYahooHistory(symbol: string, period: HistoryPeriod): Promise<HistoryPoint[] | null> {
  const sym = symbol.toUpperCase().trim();
  const cfg = toPeriodConfig(period);
  for (const suffix of YAHOO_SUFFIXES) {
    const url = `${YAHOO_CHART}/${encodeURIComponent(sym + suffix)}?interval=${cfg.interval}&range=${cfg.range}`;
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) continue;
      const data = (await r.json()) as {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: { quote?: Array<{ close?: Array<number | null>; volume?: Array<number | null> }> };
          }>;
        };
      };
      const res = data.chart?.result?.[0];
      const ts = res?.timestamp ?? [];
      const close = res?.indicators?.quote?.[0]?.close ?? [];
      const volume = res?.indicators?.quote?.[0]?.volume ?? [];
      const points: HistoryPoint[] = [];
      for (let i = 0; i < ts.length; i += 1) {
        const c = num(close[i]);
        if (!Number.isFinite(c) || c <= 0) continue;
        points.push({
          date: toYmd(ts[i]),
          close: c,
          volume: Math.max(0, Math.round(num(volume[i]) || 0)),
        });
      }
      if (!points.length) continue;
      return trimRecentPeriod(points, period);
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchVndirectHistory(symbol: string, period: HistoryPeriod): Promise<HistoryPoint[] | null> {
  const sym = symbol.toUpperCase().trim();
  const cfg = toPeriodConfig(period);
  try {
    const r = await fetch(
      `${VNDIRECT_HISTORY}?sort=date:asc&size=400&q=${encodeURIComponent(`code:${sym}`)}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!r.ok) return null;
    const data = (await r.json()) as {
      data?: Array<Record<string, unknown>>;
    };
    const rows = Array.isArray(data.data) ? data.data : [];
    const points: HistoryPoint[] = rows
      .map((row) => {
        const date = String(row.date ?? "").slice(0, 10);
        const close = normalizeToVndUnit(num(row.close));
        const volume = Math.max(0, Math.round(num(row.nmVolume) || num(row.volume) || 0));
        return { date, close, volume };
      })
      .filter((p) => p.date && Number.isFinite(p.close) && p.close > 0);
    if (!points.length) return null;
    return trimRecentPeriod(points, period);
  } catch {
    return null;
  }
}

export async function fetchHistoryWithStats(symbol: string, period: HistoryPeriod): Promise<HistoryResult | null> {
  const sym = symbol.toUpperCase().trim();
  if (!sym) return null;
  const cfg = toPeriodConfig(period);
  const yahooPoints = await fetchYahooHistory(sym, period);
  const points = yahooPoints ?? (await fetchVndirectHistory(sym, period));
  if (!points || points.length < 2) return null;

  const stats = computeStats(points);
  const indicators = computeIndicators(points);
  const forecast = computeForecast(points, cfg.horizonSessions);

  return {
    symbol: sym,
    period,
    source: yahooPoints ? "yahoo" : "vndirect_history",
    points,
    stats,
    indicators,
    forecast,
  };
}
