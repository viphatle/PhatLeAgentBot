import type { Quote } from "./types";

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_SUFFIXES = [".VN", ".HNO"] as const;
const VNDIRECT_HISTORY = "https://api-finfo.vndirect.com.vn/v4/stock_prices";

export type HistoryPeriod = "week" | "month" | "quarter" | "half" | "year";

export type HistoryPoint = {
  date: string; // YYYY-MM-DD
  close: number;
  volume: number;
};

export type HistoryIndicators = {
  ma_period: number;
  ma_value: number | null;
  ma_series: Array<number | null>;
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

export type ForecastScenario = {
  name: "bull" | "base" | "bear";
  price: number;
  probability: number;
  description: string;
};

export type Forecast = {
  next_session: number;
  horizon_end: number;
  horizon_sessions: number;
  slope_per_session: number;
  confidence: "low" | "medium" | "high";
  scenarios: ForecastScenario[];
  trend_strength: number;
  support_level: number;
  resistance_level: number;
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
    case "half":
      return { range: "1y", interval: "1d", horizonSessions: 126 };
    case "year":
    default:
      return { range: "2y", interval: "1d", horizonSessions: 252 };
  }
}

function maPeriodForPeriod(period: HistoryPeriod) {
  switch (period) {
    case "week":
      return 10;
    case "month":
      return 20;
    case "quarter":
      return 50;
    case "half":
      return 100;
    case "year":
    default:
      return 200;
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
  if (period === "half") start.setUTCMonth(start.getUTCMonth() - 6);
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

function smaSeries(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  for (let i = 0; i < values.length; i += 1) {
    if (i + 1 < period) {
      out.push(null);
      continue;
    }
    const seg = values.slice(i + 1 - period, i + 1);
    out.push(seg.reduce((a, b) => a + b, 0) / period);
  }
  return out;
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

function computeIndicators(
  allPoints: HistoryPoint[],
  visiblePoints: HistoryPoint[],
  period: HistoryPeriod,
): HistoryIndicators {
  const closes = visiblePoints.map((p) => p.close);
  const allCloses = allPoints.map((p) => p.close);
  const maPeriod = maPeriodForPeriod(period);
  const allMaSeries = smaSeries(allCloses, maPeriod);
  const maByDate = new Map<string, number | null>();
  for (let i = 0; i < allPoints.length; i += 1) {
    maByDate.set(allPoints[i].date, allMaSeries[i] ?? null);
  }
  const maSeries = visiblePoints.map((p) => maByDate.get(p.date) ?? null);
  const maValue = maSeries.length ? maSeries[maSeries.length - 1] : null;
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
  return {
    ma_period: maPeriod,
    ma_value: maValue,
    ma_series: maSeries,
    ema12,
    ema26,
    rsi14,
    macd,
    signal9,
  };
}

function computeForecast(points: HistoryPoint[], horizonSessions: number): Forecast {
  const closes = points.map((p) => p.close);
  const n = closes.length;
  const last = closes[n - 1];
  
  // Calculate support and resistance from recent price action
  const recentCloses = closes.slice(-20);
  const recentHigh = Math.max(...recentCloses);
  const recentLow = Math.min(...recentCloses);
  const supportLevel = recentLow * 0.995;
  const resistanceLevel = recentHigh * 1.005;
  
  if (n < 5) {
    const baseScenario: ForecastScenario = {
      name: "base",
      price: last,
      probability: 100,
      description: "Không đủ dữ liệu để dự báo",
    };
    return {
      next_session: last,
      horizon_end: last,
      horizon_sessions: horizonSessions,
      slope_per_session: 0,
      confidence: "low",
      scenarios: [baseScenario],
      trend_strength: 0,
      support_level: supportLevel,
      resistance_level: resistanceLevel,
    };
  }

  // Weighted linear regression (more weight on recent data)
  const lookback = Math.min(n - 1, 30);
  const weights = Array.from({ length: lookback }, (_, i) => (i + 1) / lookback);
  const xs = Array.from({ length: lookback }, (_, i) => i);
  const ys = closes.slice(-lookback);
  
  const weightedMean = (arr: number[], w: number[]) => {
    const sumW = w.reduce((a, b) => a + b, 0);
    return arr.reduce((sum, val, i) => sum + val * w[i], 0) / sumW;
  };
  
  const xMean = weightedMean(xs, weights);
  const yMean = weightedMean(ys, weights);
  
  let cov = 0;
  let varX = 0;
  for (let i = 0; i < lookback; i++) {
    cov += weights[i] * (xs[i] - xMean) * (ys[i] - yMean);
    varX += weights[i] * (xs[i] - xMean) ** 2;
  }
  
  const slope = varX > 0 ? cov / varX : 0;
  const intercept = yMean - slope * xMean;
  
  // Calculate volatility and trend strength
  const returns = ys.slice(1).map((v, i) => (ys[i] > 0 ? (v - ys[i]) / ys[i] : 0));
  const volatility = stdDev(returns);
  const trendStrength = Math.abs(slope) / (volatility * last + 0.001);
  
  // Base forecast
  const nextBase = Math.max(0, last + slope);
  const horizonBase = Math.max(0, last + slope * horizonSessions);
  
  // Multi-scenario analysis
  const volatilityFactor = volatility * last * Math.sqrt(horizonSessions);
  
  // Bull scenario: positive momentum + lower volatility
  const bullPrice = Math.min(resistanceLevel, horizonBase + volatilityFactor * 1.5);
  const bullProb = slope > 0 ? Math.min(50, 25 + trendStrength * 10) : Math.max(10, 15 - trendStrength * 5);
  
  // Bear scenario: negative momentum + higher volatility
  const bearPrice = Math.max(supportLevel, horizonBase - volatilityFactor * 1.5);
  const bearProb = slope < 0 ? Math.min(50, 25 + trendStrength * 10) : Math.max(10, 15 - trendStrength * 5);
  
  // Base scenario (most likely)
  const baseProb = 100 - bullProb - bearProb;
  
  const scenarios: ForecastScenario[] = [
    {
      name: "bull",
      price: bullPrice,
      probability: Math.round(bullProb),
      description: slope > 0 
        ? "Xu hướng tăng mạnh với đà tích cực" 
        : "Phục hồi kỹ thuật từ vùng hỗ trợ",
    },
    {
      name: "base",
      price: horizonBase,
      probability: Math.round(baseProb),
      description: Math.abs(slope) < 0.01 * last
        ? "Sideway trong biên độ hẹp"
        : slope > 0 
          ? "Xu hướng tăng ôn định"
          : "Xu hướng giảm có kiểm soát",
    },
    {
      name: "bear",
      price: bearPrice,
      probability: Math.round(bearProb),
      description: slope < 0 
        ? "Xu hướng giảm với áp lực bán" 
        : "Điều chỉnh kỹ thuật ngắn hạn",
    },
  ];
  
  // Confidence based on data quality
  let confidence: Forecast["confidence"] = "low";
  if (n >= 20 && volatility < 0.02) {
    confidence = "high";
  } else if (n >= 10 && volatility < 0.03) {
    confidence = "medium";
  }
  
  // Next session forecast with mean reversion adjustment
  const meanReversion = (yMean - last) * 0.1;
  const nextSession = Math.max(0, last + slope * 0.7 + meanReversion * 0.3);

  return {
    next_session: nextSession,
    horizon_end: horizonBase,
    horizon_sessions: horizonSessions,
    slope_per_session: slope,
    confidence,
    scenarios,
    trend_strength: Math.min(1, trendStrength),
    support_level: supportLevel,
    resistance_level: resistanceLevel,
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
      return points;
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
      `${VNDIRECT_HISTORY}?sort=date:desc&size=500&q=${encodeURIComponent(`code:${sym}`)}`,
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
    const sorted = points.sort((a, b) => a.date.localeCompare(b.date));
    return sorted;
  } catch {
    return null;
  }
}

export async function fetchHistoryWithStats(symbol: string, period: HistoryPeriod): Promise<HistoryResult | null> {
  const sym = symbol.toUpperCase().trim();
  if (!sym) return null;
  const cfg = toPeriodConfig(period);
  const yahooPoints = await fetchYahooHistory(sym, period);
  const allPoints = yahooPoints ?? (await fetchVndirectHistory(sym, period));
  if (!allPoints || allPoints.length < 2) return null;
  const points = trimRecentPeriod(allPoints, period);
  if (points.length < 2) return null;

  const stats = computeStats(points);
  const indicators = computeIndicators(allPoints, points, period);
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
