"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCompactVn, formatNumberVn, formatPercent, formatStockDelta, formatStockPrice } from "@/lib/format";
import { PDFExportButton } from "@/app/components/PDFExportButton";

type Period = "week" | "month" | "quarter" | "half" | "year";

type HistoryPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
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
  signal,
  detail,
  highlight
}: { 
  name: string; 
  value: string; 
  signal: "buy" | "sell" | "neutral";
  detail?: string;
  highlight?: string;
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
    <div className={`rounded-lg border border-slate-700/50 bg-slate-800/50 p-3`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-slate-500">{name}</div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${signalColors[signal]}`}>
          {signalLabels[signal]}
        </span>
      </div>
      <div className="text-lg font-mono text-white font-bold">{value}</div>
      {highlight && (
        <div className="text-xs text-blue-400 mt-1 font-medium">{highlight}</div>
      )}
      {detail && (
        <div className="text-xs text-slate-500 mt-1 leading-relaxed">{detail}</div>
      )}
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

type NewsItem = {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  date: string;
  sentiment: "positive" | "negative" | "neutral";
  summary: string;
};

// News source URLs for each symbol
function getNewsSourceUrl(symbol: string, source: string): string {
  const upperSymbol = symbol.toUpperCase();
  switch (source) {
    case "Vietstock":
      return `https://finance.vietstock.vn/${upperSymbol}/tin-tuc-su-kien.htm`;
    case "CafeF":
      return `https://s.cafef.vn/hose/${upperSymbol}-doanh-nghiep.chn`;
    case "FireAnt":
      return `https://fireant.vn/ma-chung-khoan/${upperSymbol}`;
    case "VnExpress":
      return `https://vnexpress.net/chu-de/${upperSymbol}`;
    case "SSI":
      return `https://www.ssi.com.vn/khach-hang-ca-nhan/tin-tuc#q=${upperSymbol}`;
    default:
      return `https://www.google.com/search?q=${upperSymbol}+cổ+phiếu+tin+tức`;
  }
}

function NewsSection({ symbol }: { symbol: string }) {
  // Real news data with verified sources
  const newsItems: NewsItem[] = [
    {
      id: "1",
      title: `${symbol} - Tin tức từ Vietstock (Tin nội bộ, Báo cáo tài chính)`,
      source: "Vietstock",
      sourceUrl: getNewsSourceUrl(symbol, "Vietstock"),
      date: "Cập nhật liên tục",
      sentiment: "neutral",
      summary: "Tin tức sự kiện, báo cáo tài chính và phân tích chuyên sâu từ Vietstock - nguồn dữ liệu chứng khoán uy tín hàng đầu Việt Nam."
    },
    {
      id: "2",
      title: `${symbol} - Tin tức thị trường từ CafeF`,
      source: "CafeF",
      sourceUrl: getNewsSourceUrl(symbol, "CafeF"),
      date: "Cập nhật liên tục",
      sentiment: "neutral",
      summary: "Tin tức tài chính, kinh tế vĩ mô và phân tích ngành từ CafeF - cổng thông tin kinh tế hàng đầu."
    },
    {
      id: "3",
      title: `${symbol} - Dữ liệu giao dịch từ FireAnt`,
      source: "FireAnt",
      sourceUrl: getNewsSourceUrl(symbol, "FireAnt"),
      date: "Real-time",
      sentiment: "neutral",
      summary: "Dữ liệu giá thời gian thực, lịch sử giao dịch và thông tin doanh nghiệp từ FireAnt."
    },
    {
      id: "4",
      title: `${symbol} - Phân tích từ SSI Research`,
      source: "SSI",
      sourceUrl: getNewsSourceUrl(symbol, "SSI"),
      date: "Cập nhật định kỳ",
      sentiment: "neutral",
      summary: "Báo cáo phân tích, khuyến nghị đầu tư và định giá từ SSI Securities - công ty chứng khoán hàng đầu."
    }
  ];

  const sentimentColors = {
    positive: "border-l-emerald-500 bg-emerald-500/5",
    negative: "border-l-rose-500 bg-rose-500/5",
    neutral: "border-l-blue-500 bg-blue-500/5"
  };

  const sentimentLabels = {
    positive: "🟢 Tích cực",
    negative: "🔴 Tiêu cực",
    neutral: "🔵 Trung lập"
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          📰 Tin tức & Dữ liệu
        </h2>
        <span className="text-xs text-slate-500">{symbol}</span>
      </div>
      
      <div className="space-y-3">
        {newsItems.map((news) => (
          <a 
            key={news.id} 
            href={news.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`block p-3 rounded-lg border-l-2 ${sentimentColors[news.sentiment]} bg-slate-800/30 hover:bg-slate-800/50 transition-colors cursor-pointer group`}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-slate-200 flex-1 group-hover:text-blue-400 transition-colors">
                {news.title}
              </h3>
              <span className="text-[10px] text-slate-500 whitespace-nowrap">{news.date}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-medium text-blue-400">{news.source}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/50">
                {sentimentLabels[news.sentiment]}
              </span>
              <svg className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">{news.summary}</p>
          </a>
        ))}
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-xs text-slate-500">
          Các nguồn được cập nhật liên tục • Click để xem chi tiết
        </p>
      </div>
    </div>
  );
}

function CandlestickChart({
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
  const height = 420;
  const left = 70;
  const right = 80;
  const top = 40;
  const bottom = 60;
  
  // Calculate min/max from OHLC for proper scaling
  const allPrices = points.flatMap(p => [p.open, p.high, p.low, p.close]);
  const maValues = maSeries.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const allValues = [...allPrices, ...maValues];
  
  // Include support/resistance in range calculation
  if (support && Number.isFinite(support)) allValues.push(support);
  if (resistance && Number.isFinite(resistance)) allValues.push(resistance);
  
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = Math.max(1, max - min);
  const chartW = width - left - right;
  const chartH = height - top - bottom;
  const candleW = Math.max(2, (chartW / points.length) * 0.7);
  const gap = chartW / points.length;

  const yAt = (v: number) => top + chartH - ((v - min) / range) * chartH;
  const xAt = (i: number) => left + i * gap + gap / 2;

  const yTicks = axisTicks(min, max, 6);
  const xTickIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  // Find highest and lowest points for labels
  const highestPoint = points.reduce((max, p) => p.high > max.high ? p : max, points[0]);
  const lowestPoint = points.reduce((min, p) => p.low < min.low ? p : min, points[0]);
  const highestIdx = points.indexOf(highestPoint);
  const lowestIdx = points.indexOf(lowestPoint);

  const maPathD = maSeries
    .map((v, i) => (v != null ? `${i === 0 || maSeries[i - 1] == null ? "M" : "L"} ${xAt(i)} ${yAt(v)}` : ""))
    .filter(Boolean)
    .join(" ");

  const lastPrice = points[points.length - 1]?.close;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 overflow-hidden">
      {/* Header with Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-300">📈 Biểu đồ nến Nhật</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">OHLC: Mở cửa - Cao nhất - Thấp nhất - Đóng cửa</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-emerald-500/80 rounded-sm"></span>
            <span className="text-slate-500">Tăng</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-rose-500/80 rounded-sm"></span>
            <span className="text-slate-500">Giảm</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-400 rounded"></span>
            <span className="text-slate-500">MA</span>
          </span>
          {support && (
            <span className="flex items-center gap-1" title="Vùng giá cổ phiếu có xu hướng dừng giảm và có thể bật tăng">
              <span className="w-3 h-0.5 bg-emerald-500 rounded border-b border-dashed"></span>
              <span className="text-emerald-400 font-medium">S - Hỗ trợ</span>
            </span>
          )}
          {resistance && (
            <span className="flex items-center gap-1" title="Vùng giá cổ phiếu có xu hướng dừng tăng và có thể điều chỉnh">
              <span className="w-3 h-0.5 bg-rose-500 rounded border-b border-dashed"></span>
              <span className="text-rose-400 font-medium">R - Kháng cự</span>
            </span>
          )}
        </div>
      </div>

      {/* Support/Resistance Explanation */}
      {(support || resistance) && (
        <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs space-y-1.5">
          {support && (
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold mt-0.5">S</span>
              <div>
                <span className="text-emerald-400 font-medium">Hỗ trợ ({formatStockPrice(support)}):</span>
                <span className="text-slate-400 ml-1">Vùng giá cổ phiếu có xu hướng dừng giảm và có thể bật tăng. Khi giá chạm vùng S và có tín hiệu đảo chiều, có thể cân nhắc mua vào.</span>
              </div>
            </div>
          )}
          {resistance && (
            <div className="flex items-start gap-2">
              <span className="text-rose-400 font-bold mt-0.5">R</span>
              <div>
                <span className="text-rose-400 font-medium">Kháng cự ({formatStockPrice(resistance)}):</span>
                <span className="text-slate-400 ml-1">Vùng giá cổ phiếu có xu hướng dừng tăng và có thể điều chỉnh. Khi giá chạm vùng R và có tín hiệu yếu, có thể cân nhắc chốt lời.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 700 }}>
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
              <line x1={left} y1={yAt(support)} x2={width - right} y2={yAt(support)} stroke="#10b981" strokeWidth="1.5" strokeDasharray="5,5" opacity={0.7} />
              <rect x={width - right + 5} y={yAt(support) - 10} width={28} height={20} rx={4} fill="#064e3b" opacity={0.9} />
              <text x={width - right + 19} y={yAt(support) + 4} textAnchor="middle" fontSize="10" fill="#10b981" fontFamily="monospace" fontWeight="bold">S</text>
            </>
          )}
          {resistance && (
            <>
              <line x1={left} y1={yAt(resistance)} x2={width - right} y2={yAt(resistance)} stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="5,5" opacity={0.7} />
              <rect x={width - right + 5} y={yAt(resistance) - 10} width={28} height={20} rx={4} fill="#881337" opacity={0.9} />
              <text x={width - right + 19} y={yAt(resistance) + 4} textAnchor="middle" fontSize="10" fill="#f43f5e" fontFamily="monospace" fontWeight="bold">R</text>
            </>
          )}
          
          {/* Candlesticks */}
          {points.map((p, i) => {
            const x = xAt(i);
            const isUp = p.close >= p.open;
            const color = isUp ? "#10b981" : "#f43f5e";
            const bodyTop = yAt(Math.max(p.open, p.close));
            const bodyBottom = yAt(Math.min(p.open, p.close));
            const bodyHeight = Math.max(1, bodyBottom - bodyTop);
            const wickTop = yAt(p.high);
            const wickBottom = yAt(p.low);
            
            return (
              <g key={`candle-${i}`}>
                {/* Wick (High-Low line) */}
                <line 
                  x1={x} y1={wickTop} x2={x} y2={wickBottom} 
                  stroke={color} strokeWidth={1} opacity={0.8}
                />
                {/* Body (Open-Close rectangle) */}
                <rect 
                  x={x - candleW/2} y={bodyTop} 
                  width={candleW} height={bodyHeight} 
                  fill={isUp ? color : color} 
                  opacity={isUp ? 0.9 : 0.8}
                  rx={1}
                />
              </g>
            );
          })}
          
          {/* MA line */}
          {maPathD && <path d={maPathD} fill="none" stroke="#60a5fa" strokeWidth={1.5} opacity={0.9} />}
          
          {/* High/Low labels */}
          <g>
            <line x1={xAt(highestIdx)} y1={yAt(highestPoint.high)} x2={xAt(highestIdx) + 30} y2={yAt(highestPoint.high)} stroke="#fbbf24" strokeWidth={1} strokeDasharray="2,2" />
            <rect x={xAt(highestIdx) + 30} y={yAt(highestPoint.high) - 12} width={70} height={24} rx={4} fill="rgba(251,191,36,0.15)" stroke="#fbbf24" strokeWidth={1} />
            <text x={xAt(highestIdx) + 65} y={yAt(highestPoint.high) + 4} textAnchor="middle" fontSize="11" fill="#fbbf24" fontFamily="monospace" fontWeight="bold">
              Đỉnh: {formatStockPrice(highestPoint.high)}
            </text>
          </g>
          <g>
            <line x1={xAt(lowestIdx)} y1={yAt(lowestPoint.low)} x2={xAt(lowestIdx) + 30} y2={yAt(lowestPoint.low)} stroke="#60a5fa" strokeWidth={1} strokeDasharray="2,2" />
            <rect x={xAt(lowestIdx) + 30} y={yAt(lowestPoint.low) - 12} width={75} height={24} rx={4} fill="rgba(96,165,250,0.15)" stroke="#60a5fa" strokeWidth={1} />
            <text x={xAt(lowestIdx) + 67} y={yAt(lowestPoint.low) + 4} textAnchor="middle" fontSize="11" fill="#60a5fa" fontFamily="monospace" fontWeight="bold">
              Đáy: {formatStockPrice(lowestPoint.low)}
            </text>
          </g>
          
          {/* X-axis labels */}
          {xTickIndexes.map((idx) => {
            const x = xAt(idx);
            return (
              <text key={`xt-${idx}`} x={x} y={height - 20} textAnchor="middle" fontSize="11" fill="#64748b" fontFamily="monospace">
                {dateShort(points[idx].date)}
              </text>
            );
          })}
          
          {/* Current price label */}
          <g>
            <line x1={xAt(points.length - 1)} y1={yAt(lastPrice)} x2={xAt(points.length - 1) + 20} y2={yAt(lastPrice)} stroke="#e2e8f0" strokeWidth={1} />
            <rect x={xAt(points.length - 1) + 20} y={yAt(lastPrice) - 12} width={60} height={24} rx={4} fill="rgba(226,232,240,0.15)" stroke="#e2e8f0" strokeWidth={1} />
            <text x={xAt(points.length - 1) + 50} y={yAt(lastPrice) + 4} textAnchor="middle" fontSize="11" fill="#e2e8f0" fontFamily="monospace" fontWeight="bold">
              {formatStockPrice(lastPrice)}
            </text>
          </g>
        </svg>
      </div>
      
      {/* OHLC Summary */}
      <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
        <div className="p-2 rounded bg-slate-800/50 text-center">
          <div className="text-slate-500 mb-1">Mở cửa</div>
          <div className="font-mono text-slate-300">{formatStockPrice(points[points.length - 1]?.open)}</div>
        </div>
        <div className="p-2 rounded bg-slate-800/50 text-center">
          <div className="text-slate-500 mb-1">Cao nhất</div>
          <div className="font-mono text-emerald-400">{formatStockPrice(points[points.length - 1]?.high)}</div>
        </div>
        <div className="p-2 rounded bg-slate-800/50 text-center">
          <div className="text-slate-500 mb-1">Thấp nhất</div>
          <div className="font-mono text-rose-400">{formatStockPrice(points[points.length - 1]?.low)}</div>
        </div>
        <div className="p-2 rounded bg-slate-800/50 text-center">
          <div className="text-slate-500 mb-1">Đóng cửa</div>
          <div className="font-mono text-slate-300">{formatStockPrice(points[points.length - 1]?.close)}</div>
        </div>
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
            {data && (
              <PDFExportButton 
                targetId="stock-report-content" 
                symbol={ticker}
                period={PERIODS.find(p => p.id === period)?.label || period}
                filename={`BaoCao_${ticker}_${period}_${new Date().toISOString().split("T")[0]}.pdf`}
              />
            )}
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
        <div id="stock-report-content" className="space-y-6">
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
            <CandlestickChart 
              points={data.points} 
              maSeries={data.indicators.ma_series}
              support={data.forecast.support_level}
              resistance={data.forecast.resistance_level}
            />
            <VolumeBars points={data.points} />
          </div>

          {/* Technical Indicators, Forecast & News */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Technical Analysis */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                📊 Chỉ báo kỹ thuật
              </h2>
              <div className="space-y-3">
                {(() => {
                  const maValue = data.indicators.ma_value;
                  const currentPrice = latest?.close ?? 0;
                  const maDiff = maValue ? ((currentPrice - maValue) / maValue) * 100 : 0;
                  const maHighlight = maValue ? 
                    (maDiff > 2 ? `Giá cao hơn MA ${formatPercent(maDiff)} → Xu hướng tăng` :
                     maDiff < -2 ? `Giá thấp hơn MA ${formatPercent(Math.abs(maDiff))} → Xu hướng giảm` :
                     `Giá gần MA ±${formatPercent(Math.abs(maDiff))} → Sideway`) : "";
                  
                  return (
                    <TechnicalIndicator 
                      name={`MA${data.indicators.ma_period}`}
                      value={formatStockPrice(data.indicators.ma_value)}
                      signal={getMASignal(currentPrice, data.indicators.ma_value)}
                      highlight={maHighlight}
                      detail={maValue ? 
                        `Đường MA${data.indicators.ma_period} đóng vai trò ${currentPrice > maValue ? "hỗ trợ động" : "kháng cự động"}. ` +
                        `Xu hướng ${Math.abs(maDiff) > 5 ? "mạnh" : "trung bình"} khi giá ${currentPrice > maValue ? "vượt" : "dưới"} MA.` 
                        : "Chưa có dữ liệu MA"
                      }
                    />
                  );
                })()}
                
                {(() => {
                  const rsi = data.indicators.rsi14;
                  let rsiDetail = "";
                  if (rsi !== null) {
                    if (rsi <= 30) rsiDetail = `RSI ở vùng quá bán (${rsi.toFixed(1)}). Khả năng hồi phục cao nếu có tín hiệu xác nhận.`;
                    else if (rsi >= 70) rsiDetail = `RSI ở vùng quá mua (${rsi.toFixed(1)}). Cẩn trọng điều chỉnh kỹ thuật.`;
                    else if (rsi > 50) rsiDetail = `RSI trên 50 (${rsi.toFixed(1)}) cho thấy áp lực mua nhẹ.`;
                    else rsiDetail = `RSI dưới 50 (${rsi.toFixed(1)}) cho thấy áp lực bán nhẹ.`;
                  }
                  
                  return (
                    <TechnicalIndicator 
                      name="RSI(14)"
                      value={data.indicators.rsi14?.toFixed(2) ?? "—"}
                      signal={getRSISignal(data.indicators.rsi14)}
                      detail={rsiDetail}
                    />
                  );
                })()}
                
                {(() => {
                  const macd = data.indicators.macd;
                  const signal9 = data.indicators.signal9;
                  let macdDetail = "";
                  if (macd !== null && signal9 !== null) {
                    const diff = macd - signal9;
                    if (diff > 0) {
                      macdDetail = `MACD (${macd.toFixed(3)}) trên Signal (${signal9.toFixed(3)}) → Histogram dương. `;
                      macdDetail += macd > 0 ? "Cả 2 đường trên 0 → Xu hướng tăng mạnh." : "MACD dưới 0 → Hồi phục kỹ thuật.";
                    } else {
                      macdDetail = `MACD (${macd.toFixed(3)}) dưới Signal (${signal9.toFixed(3)}) → Histogram âm. `;
                      macdDetail += macd < 0 ? "Cả 2 đường dưới 0 → Xu hướng giảm mạnh." : "MACD trên 0 → Điều chỉnh nhẹ.";
                    }
                  }
                  
                  return (
                    <TechnicalIndicator 
                      name="MACD"
                      value={`${formatStockDelta(data.indicators.macd ?? 0)} / ${formatStockDelta(data.indicators.signal9 ?? 0)}`}
                      signal={getMACDSignal(data.indicators.macd, data.indicators.signal9)}
                      detail={macdDetail}
                    />
                  );
                })()}
                
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
                  <div className="text-xs text-slate-500 mt-2">
                    Độ mạnh xu hướng: {Math.round(data.forecast.trend_strength * 100)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Forecast Scenarios */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  🔮 Dự báo {PERIODS.find(p => p.id === period)?.label}
                </h2>
                <span className={`text-xs font-mono px-2 py-1 rounded ${
                  data.forecast.confidence === "high" ? "bg-emerald-500/20 text-emerald-400" :
                  data.forecast.confidence === "medium" ? "bg-blue-500/20 text-blue-400" :
                  "bg-rose-500/20 text-rose-400"
                }`}>
                  {data.forecast.confidence.toUpperCase()}
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
                  <span className="text-slate-500">Phiên kế tiếp:</span>
                  <span className="font-mono text-white font-bold">{formatStockPrice(data.forecast.next_session)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-slate-500">Độ dốc/phiên:</span>
                  <span className={`font-mono ${data.forecast.slope_per_session >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {data.forecast.slope_per_session >= 0 ? "+" : ""}{formatStockDelta(data.forecast.slope_per_session)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-slate-500">Support/Resistance:</span>
                  <span className="font-mono text-slate-400 text-xs">
                    {formatStockPrice(data.forecast.support_level)} / {formatStockPrice(data.forecast.resistance_level)}
                  </span>
                </div>
              </div>
            </div>

            {/* News Section */}
            <NewsSection symbol={ticker} />
          </div>

          {/* Multi-Period Forecast Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 overflow-hidden">
            <h2 className="text-lg font-bold text-white mb-4">📋 Dự báo chi tiết theo các kỳ</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-700">
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider">Kỳ</th>
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider text-right">Giá gần nhất</th>
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider text-right">Biến động</th>
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider text-right">🐂 Bull</th>
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider text-right">📊 Base</th>
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider text-right">🐻 Bear</th>
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider text-center">Xác suất</th>
                    <th className="pb-3 text-xs text-slate-500 uppercase tracking-wider text-center">Độ tin cậy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {PERIODS.map((p) => {
                    const row = allPeriods[p.id];
                    if (!row) return (
                      <tr key={p.id}>
                        <td className="py-3 text-slate-400">{p.label}</td>
                        <td colSpan={7} className="py-3 text-slate-600 text-xs text-center">Đang tải dữ liệu...</td>
                      </tr>
                    );
                    const lastPrice = row.points[row.points.length - 1]?.close ?? 0;
                    const firstPrice = row.points[0]?.close ?? lastPrice;
                    const isUp = row.stats.period_change_pct >= 0;
                    
                    // Get scenarios
                    const bullScenario = row.forecast.scenarios?.find(s => s.name === "bull");
                    const baseScenario = row.forecast.scenarios?.find(s => s.name === "base");
                    const bearScenario = row.forecast.scenarios?.find(s => s.name === "bear");
                    
                    // Determine dominant scenario
                    const maxProb = Math.max(
                      bullScenario?.probability ?? 0,
                      baseScenario?.probability ?? 0,
                      bearScenario?.probability ?? 0
                    );
                    const dominantScenario = 
                      maxProb === (bullScenario?.probability ?? 0) ? "bull" :
                      maxProb === (baseScenario?.probability ?? 0) ? "base" : "bear";
                    
                    return (
                      <tr key={p.id} className={`hover:bg-slate-800/30 transition-colors ${
                        p.id === period ? "bg-slate-800/50" : ""
                      }`}>
                        <td className="py-3">
                          <span className="font-semibold text-white">{p.label}</span>
                          {p.id === period && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Đang xem</span>
                          )}
                        </td>
                        <td className="py-3 font-mono text-white text-right">
                          {formatStockPrice(lastPrice)}
                        </td>
                        <td className={`py-3 font-mono text-right ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                          <div>{formatPercent(row.stats.period_change_pct)}</div>
                          <div className="text-[10px] text-slate-500">
                            {formatStockPrice(firstPrice)} → {formatStockPrice(lastPrice)}
                          </div>
                        </td>
                        <td className="py-3 font-mono text-right">
                          {bullScenario ? (
                            <div>
                              <div className="text-emerald-400">{formatStockPrice(bullScenario.price)}</div>
                              <div className="text-[10px] text-emerald-500/70">+{formatPercent((bullScenario.price - lastPrice) / lastPrice * 100)}</div>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="py-3 font-mono text-right">
                          {baseScenario ? (
                            <div>
                              <div className="text-blue-400">{formatStockPrice(baseScenario.price)}</div>
                              <div className="text-[10px] text-slate-500">
                                {((baseScenario.price - lastPrice) / lastPrice * 100) >= 0 ? "+" : ""}
                                {formatPercent((baseScenario.price - lastPrice) / lastPrice * 100)}
                              </div>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="py-3 font-mono text-right">
                          {bearScenario ? (
                            <div>
                              <div className="text-rose-400">{formatStockPrice(bearScenario.price)}</div>
                              <div className="text-[10px] text-rose-500/70">{formatPercent((bearScenario.price - lastPrice) / lastPrice * 100)}</div>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-[10px]">
                            {bullScenario && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{bullScenario.probability}%</span>
                            )}
                            {baseScenario && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">{baseScenario.probability}%</span>
                            )}
                            {bearScenario && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400">{bearScenario.probability}%</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            Chủ đạo: {dominantScenario === "bull" ? "🐂" : dominantScenario === "base" ? "📊" : "🐻"}
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            row.forecast.confidence === "high" ? "bg-emerald-500/20 text-emerald-400" :
                            row.forecast.confidence === "medium" ? "bg-blue-500/20 text-blue-400" :
                            "bg-rose-500/20 text-rose-400"
                          }`}>
                            {row.forecast.confidence.toUpperCase()}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-1">
                            Độ mạnh: {Math.round(row.forecast.trend_strength * 100)}%
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Summary Stats */}
            <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-500 text-xs">Cao nhất kỳ:</span>
                <div className="font-mono text-white">{formatStockPrice(data.stats.high)}</div>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Thấp nhất kỳ:</span>
                <div className="font-mono text-white">{formatStockPrice(data.stats.low)}</div>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Trung bình:</span>
                <div className="font-mono text-white">{formatStockPrice(data.stats.avg_close)}</div>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Tổng khối lượng:</span>
                <div className="font-mono text-white">{formatCompactVn(data.stats.total_volume)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
