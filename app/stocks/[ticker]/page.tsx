"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCompactVn, formatNumberVn, formatPercent, formatStockDelta, formatStockPrice } from "@/lib/format";

type Period = "week" | "month" | "quarter" | "half" | "year";

type HistoryPoint = {
  date: string;
  close: number;
  volume: number;
};

type ForecastScenario = {
  name: "bull" | "base" | "bear";
  price: number;
  probability: number;
  description: string;
};

type HistoryResponse = {
  symbol: string;
  period: Period;
  source: string;
  points: HistoryPoint[];
  stats: {
    points: number;
    high: number;
    low: number;
    avg_close: number;
    total_volume: number;
    avg_volume: number;
    period_change_pct: number;
    volatility_pct: number;
  };
  indicators: {
    ma_period: number;
    ma_value: number | null;
    ma_series: Array<number | null>;
    ema12: number | null;
    ema26: number | null;
    rsi14: number | null;
    macd: number | null;
    signal9: number | null;
  };
  forecast: {
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
};

type Tone = "good" | "warn" | "neutral";

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "week", label: "Tuần" },
  { id: "month", label: "Tháng" },
  { id: "quarter", label: "Quý" },
  { id: "half", label: "6 Tháng" },
  { id: "year", label: "Năm" },
];

function dateShort(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function axisTicks(min: number, max: number, count: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (count < 2) return [min];
  const step = (max - min) / (count - 1 || 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

function getTrendColor(trend: number): string {
  if (trend > 0.6) return "text-emerald-400";
  if (trend > 0.3) return "text-emerald-300";
  if (trend > -0.3) return "text-slate-400";
  if (trend > -0.6) return "text-rose-300";
  return "text-rose-400";
}

function getTrendBg(trend: number): string {
  if (trend > 0.6) return "bg-emerald-500/20 border-emerald-500/40";
  if (trend > 0.3) return "bg-emerald-500/10 border-emerald-500/30";
  if (trend > -0.3) return "bg-slate-500/10 border-slate-500/30";
  if (trend > -0.6) return "bg-rose-500/10 border-rose-500/30";
  return "bg-rose-500/20 border-rose-500/40";
}

function StatCard({ 
  label, 
  value, 
  subtext, 
  trend,
  loading 
}: { 
  label: string; 
  value: string; 
  subtext?: string;
  trend?: number;
  loading?: boolean;
}) {
  const colorClass = trend !== undefined ? getTrendBg(trend) : "bg-slate-800/50 border-slate-700/50";
  
  return (
    <div className={`rounded-xl border ${colorClass} p-4 transition-all hover:scale-[1.02]`}>
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      {loading ? (
        <div className="h-8 flex items-center">
          <span className="text-slate-600 text-sm">Loading...</span>
        </div>
      ) : (
        <>
          <div className="text-2xl font-black font-mono text-white">{value}</div>
          {subtext && <div className="text-xs text-slate-500 mt-1">{subtext}</div>}
        </>
      )}
    </div>
  );
}

function getRSISignal(rsi: number | null): "buy" | "sell" | "neutral" {
  if (rsi === null) return "neutral";
  if (rsi <= 30) return "buy";
  if (rsi >= 70) return "sell";
  return "neutral";
}

function getMACDSignal(macd: number | null, signal: number | null): "buy" | "sell" | "neutral" {
  if (macd === null || signal === null) return "neutral";
  if (macd > signal && macd > 0) return "buy";
  if (macd < signal && macd < 0) return "sell";
  return "neutral";
}

function getMASignal(price: number, ma: number | null): "buy" | "sell" | "neutral" {
  if (ma === null) return "neutral";
  if (price > ma * 1.02) return "buy";
  if (price < ma * 0.98) return "sell";
  return "neutral";
}

function TechnicalIndicator({ 
  name, 
  value, 
  signal 
}: { 
  name: string; 
  value: string; 
  signal: "buy" | "sell" | "neutral";
}) {
  const signalColors = {
    buy: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    sell: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    neutral: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  };
  
  const signalLabels = {
    buy: "MUA",
    sell: "BÁN", 
    neutral: "TRUNG LẬP",
  };

  return (
    <div className={`rounded-lg border border-slate-700/50 bg-slate-800/50 p-3 flex items-center justify-between`}>
      <div>
        <div className="text-xs text-slate-500">{name}</div>
        <div className="text-lg font-mono text-white font-bold">{value}</div>
      </div>
      <span className={`text-[10px] font-bold px-2 py-1 rounded ${signalColors[signal]}`}>
        {signalLabels[signal]}
      </span>
    </div>
  );
}

function ScenarioCard({ scenario, currentPrice }: { scenario: ForecastScenario; currentPrice: number }) {
  const change = ((scenario.price - currentPrice) / currentPrice) * 100;
  const isPositive = change >= 0;
  
  const colorClass = scenario.name === "bull" 
    ? "border-emerald-500/30 bg-emerald-500/10" 
    : scenario.name === "bear"
    ? "border-rose-500/30 bg-rose-500/10"
    : "border-blue-500/30 bg-blue-500/10";
    
  const probColor = scenario.probability > 50 ? "text-emerald-400" : scenario.probability > 30 ? "text-blue-400" : "text-slate-400";

  return (
    <div className={`rounded-xl border ${colorClass} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
          {scenario.name === "bull" ? "🐂 Bull Case" : scenario.name === "bear" ? "🐻 Bear Case" : "📊 Base Case"}
        </span>
        <span className={`text-xs font-mono ${probColor}`}>{scenario.probability}% prob</span>
      </div>
      <div className="text-2xl font-black font-mono text-white mb-1">
        {formatStockPrice(scenario.price)}
      </div>
      <div className={`text-sm font-mono ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
        {isPositive ? "+" : ""}{formatPercent(change)}
      </div>
      <p className="text-xs text-slate-500 mt-2">{scenario.description}</p>
    </div>
  );
}

function toneClass(tone: Tone) {
  if (tone === "good") return "text-emerald-400";
  if (tone === "warn") return "text-rose-400";
  return "text-slate-400";
}

function PriceChart({
  points,
  maSeries,
  support,
  resistance,
}: {
  points: HistoryPoint[];
  maSeries: Array<number | null>;
  support?: number;
  resistance?: number;
}) {
  const width = 920;
  const height = 360;
  const left = 70;
  const right = 38;
  const top = 24;
  const bottom = 48;
  const values = points.map((p) => p.close);
  const maValues = maSeries.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const allValues = maValues.length ? [...values, ...maValues] : values;
  
  // Include support/resistance in range calculation
  if (support && Number.isFinite(support)) allValues.push(support);
  if (resistance && Number.isFinite(resistance)) allValues.push(resistance);
  
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = Math.max(1, max - min);
  const chartW = width - left - right;
  const chartH = height - top - bottom;
  const dx = chartW / Math.max(1, points.length - 1);

  const yAt = (v: number) => top + chartH - ((v - min) / range) * chartH;
  const xAt = (i: number) => left + i * dx;

  const yTicks = axisTicks(min, max, 6);
  const xTickIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.close)}`)
    .join(" ");

  const maPathD = maSeries
    .map((v, i) => (v != null ? `${i === 0 || maSeries[i - 1] == null ? "M" : "L"} ${xAt(i)} ${yAt(v)}` : ""))
    .filter(Boolean)
    .join(" ");

  const lastPrice = points[points.length - 1]?.close;
  const up = points.length > 1 ? lastPrice >= points[0].close : true;
  const priceColor = up ? "#34d399" : "#fb7185";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-300">📈 Đồ thị giá đóng cửa</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-emerald-400 rounded"></span>
            <span className="text-slate-500">Giá</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-400 rounded"></span>
            <span className="text-slate-500">MA</span>
          </span>
          {support && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-emerald-600 rounded border-b border-dashed"></span>
              <span className="text-slate-500">Support</span>
            </span>
          )}
          {resistance && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-rose-600 rounded border-b border-dashed"></span>
              <span className="text-slate-500">Resistance</span>
            </span>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 600 }}>
          {/* Grid lines */}
          {yTicks.map((t, i) => {
            const y = yAt(t);
            return (
              <g key={`yt-${i}`}>
                <line x1={left} y1={y} x2={width - right} y2={y} stroke="rgba(51,65,85,0.5)" strokeWidth="1" />
                <text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b" fontFamily="monospace">
                  {formatCompactVn(t)}
                </text>
              </g>
            );
          })}
          
          {/* Support/Resistance lines */}
          {support && (
            <>
              <line x1={left} y1={yAt(support)} x2={width - right} y2={yAt(support)} stroke="#059669" strokeWidth="1" strokeDasharray="4,4" opacity={0.6} />
              <text x={width - right + 4} y={yAt(support) + 4} fontSize="10" fill="#059669" fontFamily="monospace">S</text>
            </>
          )}
          {resistance && (
            <>
              <line x1={left} y1={yAt(resistance)} x2={width - right} y2={yAt(resistance)} stroke="#dc2626" strokeWidth="1" strokeDasharray="4,4" opacity={0.6} />
              <text x={width - right + 4} y={yAt(resistance) + 4} fontSize="10" fill="#dc2626" fontFamily="monospace">R</text>
            </>
          )}
          
          {/* Price line */}
          <path d={pathD} fill="none" stroke={priceColor} strokeWidth={2} />
          
          {/* MA line */}
          {maPathD && <path d={maPathD} fill="none" stroke="#60a5fa" strokeWidth={1.5} opacity={0.8} />}
          
          {/* X-axis labels */}
          {xTickIndexes.map((idx) => {
            const x = xAt(idx);
            return (
              <text key={`xt-${idx}`} x={x} y={height - 16} textAnchor="middle" fontSize="11" fill="#64748b" fontFamily="monospace">
                {dateShort(points[idx].date)}
              </text>
            );
          })}
          
          {/* Current price label */}
          <text x={xAt(points.length - 1) + 8} y={yAt(lastPrice) - 8} fontSize="11" fill={priceColor} fontWeight="bold" fontFamily="monospace">
            {formatStockPrice(lastPrice)}
          </text>
        </svg>
      </div>
    </div>
  );
}

function VolumeBars({ points }: { points: HistoryPoint[] }) {
  const width = 920;
  const height = 200;
  const left = 70;
  const right = 38;
  const top = 20;
  const bottom = 40;
  const chartW = width - left - right;
  const chartH = height - top - bottom;
  const maxVol = Math.max(...points.map((p) => p.volume), 1);
  const barW = chartW / points.length;

  const yTicks = axisTicks(0, maxVol, 4);
  const xTickIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-300">📊 Khối lượng giao dịch</h3>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 600 }}>
          {yTicks.map((t, i) => {
            const y = top + chartH - (t / maxVol) * chartH;
            return (
              <g key={`vt-${i}`}>
                <line x1={left} y1={y} x2={width - right} y2={y} stroke="rgba(51,65,85,0.3)" strokeWidth="1" />
                <text x={left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b" fontFamily="monospace">
                  {formatCompactVn(t)}
                </text>
              </g>
            );
          })}
          {points.map((p, i) => {
            const h = Math.max(2, (p.volume / maxVol) * chartH);
            const x = left + i * barW + 1;
            const y = top + chartH - h;
            const isHighVolume = p.volume > maxVol * 0.7;
            return (
              <rect
                key={`${p.date}-vol`}
                x={x}
                y={y}
                width={Math.max(1, barW - 2)}
                height={h}
                rx={2}
                fill={isHighVolume ? "#3b82f6" : "#1e40af"}
                opacity={isHighVolume ? 0.9 : 0.5}
              />
            );
          })}
          {xTickIndexes.map((idx) => {
            const x = left + idx * barW + barW / 2;
            return (
              <text key={`vx-${idx}`} x={x} y={height - 12} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="monospace">
                {dateShort(points[idx].date)}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function StockDetailPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [allPeriods, setAllPeriods] = useState<Partial<Record<Period, HistoryResponse>>>({});
  const [lastUpdate, setLastUpdate] = useState<string>("");

  useEffect(() => {
    let stop = false;
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/history?period=${period}&ts=${Date.now()}`, {
          cache: "no-store",
        });
        const j = (await r.json().catch(() => ({}))) as HistoryResponse & { error?: string };
        if (stop) return;
        if (!r.ok) {
          setErr(j.error ?? "Không lấy được dữ liệu.");
          setData(null);
        } else {
          setData(j);
          setLastUpdate(new Date().toLocaleTimeString("vi-VN"));
        }
      } catch {
        if (!stop) {
          setErr("Không kết nối được dữ liệu lịch sử. Vui lòng thử lại.");
          setData(null);
        }
      }
      setLoading(false);
    };
    void load();
    const t = setInterval(() => void load(), 10_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [ticker, period]);

  useEffect(() => {
    let stop = false;
    void (async () => {
      const result: Partial<Record<Period, HistoryResponse>> = {};
      await Promise.all(
        PERIODS.map(async (p) => {
          try {
            const r = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/history?period=${p.id}`);
            if (!r.ok) return;
            const j = (await r.json()) as HistoryResponse;
            result[p.id] = j;
          } catch {
            return;
          }
        }),
      );
      if (!stop) setAllPeriods(result);
    })();
    return () => {
      stop = true;
    };
  }, [ticker]);

  const latest = useMemo(() => data?.points[data.points.length - 1] ?? null, [data]);
  const periodRange = useMemo(() => {
    if (!data?.points.length) return "";
    const first = data.points[0].date;
    const last = data.points[data.points.length - 1].date;
    return `${dateShort(first)} - ${dateShort(last)}`;
  }, [data]);

  const trendAlignment = useMemo(() => {
    if (!data) return 0;
    const rsiSignal = getRSISignal(data.indicators.rsi14);
    const macdSignal = getMACDSignal(data.indicators.macd, data.indicators.signal9);
    const maSignal = getMASignal(latest?.close ?? 0, data.indicators.ma_value);
    
    let buyCount = 0;
    let sellCount = 0;
    [rsiSignal, macdSignal, maSignal].forEach(s => {
      if (s === "buy") buyCount++;
      if (s === "sell") sellCount++;
    });
    
    if (buyCount >= 2) return 1;
    if (sellCount >= 2) return -1;
    return 0;
  }, [data, latest]);

  return (
    <main className="min-h-screen bg-[#0a0f1a] p-4 md:p-6">
      {/* Header */}
      <header className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:p-6 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-black font-mono ${
              trendAlignment > 0 ? "bg-emerald-500/20 text-emerald-400" : 
              trendAlignment < 0 ? "bg-rose-500/20 text-rose-400" : 
              "bg-slate-700/50 text-slate-400"
            }`}>
              {ticker}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl font-mono">
                {ticker} <span className="text-slate-500">Analytics</span>
              </h1>
              <p className="text-sm text-slate-400">
                Phân tích kỹ thuật & Dự báo xu hướng
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link 
              href="/" 
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-600 hover:text-white transition-colors"
            >
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Period Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                p.id === period 
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" 
                  : "border border-slate-700 bg-slate-800/50 text-slate-400 hover:text-white hover:border-slate-600"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        
        {lastUpdate && (
          <div className="mt-3 text-xs text-slate-500 font-mono">
            🔄 Cập nhật: {lastUpdate} • {periodRange}
          </div>
        )}
      </header>

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <div className="text-slate-500 text-lg">Đang tải dữ liệu...</div>
        </div>
      )}
      
      {err && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 mb-6">
          <p className="text-rose-400">{err}</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard 
              label="Giá hiện tại" 
              value={formatStockPrice(latest?.close)}
              subtext={`Vol: ${formatCompactVn(latest?.volume ?? 0)}`}
              trend={data.stats.period_change_pct / 100}
            />
            <StatCard 
              label="Biến động kỳ" 
              value={formatPercent(data.stats.period_change_pct)}
              trend={data.stats.period_change_pct / 100}
            />
            <StatCard 
              label="Khối lượng TB" 
              value={formatCompactVn(data.stats.avg_volume)}
              subtext={`Total: ${formatCompactVn(data.stats.total_volume)}`}
            />
            <StatCard 
              label="Độ biến động" 
              value={formatPercent(data.stats.volatility_pct)}
              subtext={data.stats.volatility_pct > 30 ? "Cao - Cẩn trọng" : data.stats.volatility_pct < 15 ? "Thấp - Ổn định" : "Trung bình"}
            />
          </div>

          {/* Charts */}
          <div className="space-y-4">
            <PriceChart 
              points={data.points} 
              maSeries={data.indicators.ma_series}
              support={data.forecast.support_level}
              resistance={data.forecast.resistance_level}
            />
            <VolumeBars points={data.points} />
          </div>

          {/* Technical Indicators & Forecast */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Technical Analysis */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                📊 Chỉ báo kỹ thuật
              </h2>
              <div className="space-y-3">
                <TechnicalIndicator 
                  name={`MA${data.indicators.ma_period}`}
                  value={formatStockPrice(data.indicators.ma_value)}
                  signal={getMASignal(latest?.close ?? 0, data.indicators.ma_value)}
                />
                <TechnicalIndicator 
                  name="RSI(14)"
                  value={data.indicators.rsi14?.toFixed(2) ?? "—"}
                  signal={getRSISignal(data.indicators.rsi14)}
                />
                <TechnicalIndicator 
                  name="MACD"
                  value={`${formatStockDelta(data.indicators.macd ?? 0)} / ${formatStockDelta(data.indicators.signal9 ?? 0)}`}
                  signal={getMACDSignal(data.indicators.macd, data.indicators.signal9)}
                />
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 mt-4">
                  <div className="text-xs text-slate-500 mb-2">Tổng hợp tín hiệu</div>
                  <div className={`text-sm font-medium ${
                    trendAlignment > 0 ? "text-emerald-400" : 
                    trendAlignment < 0 ? "text-rose-400" : "text-slate-400"
                  }`}>
                    {trendAlignment > 0 ? "🟢 Xu hướng tích cực - Cân nhắc tích lũy" : 
                     trendAlignment < 0 ? "🔴 Xu hướng tiêu cực - Thận trọng quan sát" : 
                     "⚪ Tín hiệu trung lập - Chờ xác nhận"}
                  </div>
                </div>
              </div>
            </div>

            {/* Forecast Scenarios */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  🔮 Dự báo đa kịch bản
                </h2>
                <span className={`text-xs font-mono px-2 py-1 rounded ${
                  data.forecast.confidence === "high" ? "bg-emerald-500/20 text-emerald-400" :
                  data.forecast.confidence === "medium" ? "bg-blue-500/20 text-blue-400" :
                  "bg-rose-500/20 text-rose-400"
                }`}>
                  Độ tin cậy: {data.forecast.confidence.toUpperCase()}
                </span>
              </div>
              
              <div className="space-y-3">
                {data.forecast.scenarios?.map((scenario) => (
                  <ScenarioCard 
                    key={scenario.name} 
                    scenario={scenario} 
                    currentPrice={latest?.close ?? 0}
                  />
                ))}
              </div>

              <div className="mt-4 p-3 rounded-lg border border-slate-700/50 bg-slate-800/30">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Phiên kế tiếp (dự báo):</span>
                  <span className="font-mono text-white font-bold">{formatStockPrice(data.forecast.next_session)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-slate-500">Xu hướng/phiên:</span>
                  <span className={`font-mono ${data.forecast.slope_per_session >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {data.forecast.slope_per_session >= 0 ? "+" : ""}{formatStockDelta(data.forecast.slope_per_session)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Period Forecast Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 overflow-hidden">
            <h2 className="text-lg font-bold text-white mb-4">📋 Dự báo theo các kỳ</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-700">
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider">Kỳ</th>
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider">Biến động</th>
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider">Dự báo phiên sau</th>
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider">Mục tiêu cuối kỳ</th>
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider">Độ dốc</th>
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider">Tin cậy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {PERIODS.map((p) => {
                    const row = allPeriods[p.id];
                    if (!row) return (
                      <tr key={p.id}>
                        <td className="py-3 text-slate-400">{p.label}</td>
                        <td colSpan={5} className="py-3 text-slate-600 text-xs">Đang tải...</td>
                      </tr>
                    );
                    const lastPrice = row.points[row.points.length - 1]?.close ?? 0;
                    const isUp = row.stats.period_change_pct >= 0;
                    const isForecastUp = row.forecast.horizon_end >= lastPrice;
                    const slopeUp = row.forecast.slope_per_session >= 0;
                    
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 font-semibold text-white">{p.label}</td>
                        <td className={`py-3 font-mono ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatPercent(row.stats.period_change_pct)}
                        </td>
                        <td className="py-3 font-mono text-white">
                          {formatStockPrice(row.forecast.next_session)}
                        </td>
                        <td className={`py-3 font-mono ${isForecastUp ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatStockPrice(row.forecast.horizon_end)}
                        </td>
                        <td className={`py-3 font-mono ${slopeUp ? "text-emerald-400" : "text-rose-400"}`}>
                          {slopeUp ? "+" : ""}{formatStockDelta(row.forecast.slope_per_session)}
                        </td>
                        <td className="py-3">
                          <span className={`text-xs font-medium ${
                            row.forecast.confidence === "high" ? "text-emerald-400" :
                            row.forecast.confidence === "medium" ? "text-blue-400" :
                            "text-rose-400"
                          }`}>
                            {row.forecast.confidence.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
