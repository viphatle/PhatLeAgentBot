"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Period = "week" | "month" | "quarter" | "year";

type HistoryPoint = {
  date: string;
  close: number;
  volume: number;
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
    sma20: number | null;
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
  };
};

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "week", label: "Tuần" },
  { id: "month", label: "Tháng" },
  { id: "quarter", label: "Quý" },
  { id: "year", label: "Năm" },
];

function fmtVnd(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("vi-VN");
}

function fmtPct(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function PriceChart({ points }: { points: HistoryPoint[] }) {
  const width = 880;
  const height = 280;
  const pad = 24;
  const values = points.map((p) => p.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const dx = (width - pad * 2) / Math.max(1, points.length - 1);

  const path = points
    .map((p, i) => {
      const x = pad + i * dx;
      const y = pad + ((max - p.close) / range) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const first = values[0];
  const last = values[values.length - 1];
  const up = last >= first;

  return (
    <div className="rounded-xl border border-line/70 bg-surface/40 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
        <span>Đồ thị giá đóng cửa</span>
        <span className={up ? "text-up" : "text-down"}>
          {fmtVnd(last)} ({fmtPct(first > 0 ? ((last - first) / first) * 100 : 0)})
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
        <defs>
          <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? "#2fd28b" : "#ff6b6b"} stopOpacity="0.95" />
            <stop offset="100%" stopColor={up ? "#2fd28b" : "#ff6b6b"} stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="url(#lineGlow)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function VolumeBars({ points }: { points: HistoryPoint[] }) {
  const maxVol = Math.max(...points.map((p) => p.volume), 1);
  return (
    <div className="rounded-xl border border-line/70 bg-surface/40 p-3">
      <div className="mb-2 text-xs text-slate-300">Khối lượng giao dịch theo phiên</div>
      <div className="flex h-24 items-end gap-1">
        {points.map((p) => (
          <div
            key={`${p.date}-vol`}
            className="flex-1 rounded-t bg-accent/65"
            style={{ height: `${Math.max(4, (p.volume / maxVol) * 100)}%` }}
            title={`${p.date}: ${p.volume.toLocaleString("vi-VN")}`}
          />
        ))}
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

  useEffect(() => {
    let stop = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      const r = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/history?period=${period}`);
      const j = (await r.json().catch(() => ({}))) as HistoryResponse & { error?: string };
      if (stop) return;
      if (!r.ok) {
        setErr(j.error ?? "Không lấy được dữ liệu.");
        setData(null);
      } else {
        setData(j);
      }
      setLoading(false);
    })();
    return () => {
      stop = true;
    };
  }, [ticker, period]);

  const latest = useMemo(() => data?.points[data.points.length - 1] ?? null, [data]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-6 rounded-2xl p-5 glass-card md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl">MÃ CK: {ticker}</h1>
            <p className="mt-2 text-sm text-slate-300">
              Thống kê giá, khối lượng, chỉ báo và dự báo theo tuần/tháng/quý/năm.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-lg subtle-btn px-3 py-1.5 text-sm text-slate-100">
              Quay trở lại trang chủ
            </Link>
          </div>
        </div>
      </header>

      <section className="mb-4 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              p.id === period ? "brand-btn text-white" : "subtle-btn text-slate-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </section>

      {loading && <p className="text-sm text-slate-300">Đang tải dữ liệu...</p>}
      {err && <p className="text-sm text-down">{err}</p>}

      {data && (
        <div className="grid gap-6">
          <section className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-line/70 bg-surface/35 p-3">
              <div className="text-xs text-muted">Giá đóng cửa gần nhất</div>
              <div className="mt-1 font-mono text-lg text-white">{fmtVnd(latest?.close)}</div>
            </div>
            <div className="rounded-xl border border-line/70 bg-surface/35 p-3">
              <div className="text-xs text-muted">Biến động kỳ</div>
              <div className={`mt-1 font-mono text-lg ${data.stats.period_change_pct >= 0 ? "text-up" : "text-down"}`}>
                {fmtPct(data.stats.period_change_pct)}
              </div>
            </div>
            <div className="rounded-xl border border-line/70 bg-surface/35 p-3">
              <div className="text-xs text-muted">Khối lượng trung bình</div>
              <div className="mt-1 font-mono text-lg text-white">{fmtVnd(data.stats.avg_volume)}</div>
            </div>
            <div className="rounded-xl border border-line/70 bg-surface/35 p-3">
              <div className="text-xs text-muted">Độ biến động năm hoá</div>
              <div className="mt-1 font-mono text-lg text-white">{fmtPct(data.stats.volatility_pct)}</div>
            </div>
          </section>

          <PriceChart points={data.points} />
          <VolumeBars points={data.points} />

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-line/70 bg-surface/35 p-4">
              <h2 className="text-base font-bold text-white">Chỉ báo kỹ thuật</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>SMA20: <span className="font-mono">{fmtVnd(data.indicators.sma20)}</span></div>
                <div>EMA12: <span className="font-mono">{fmtVnd(data.indicators.ema12)}</span></div>
                <div>EMA26: <span className="font-mono">{fmtVnd(data.indicators.ema26)}</span></div>
                <div>RSI14: <span className="font-mono">{fmtVnd(data.indicators.rsi14)}</span></div>
                <div>MACD: <span className="font-mono">{fmtVnd(data.indicators.macd)}</span></div>
                <div>Signal9: <span className="font-mono">{fmtVnd(data.indicators.signal9)}</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-line/70 bg-surface/35 p-4">
              <h2 className="text-base font-bold text-white">Dự báo xu hướng</h2>
              <div className="mt-3 grid gap-2 text-sm">
                <div>
                  Phiên kế tiếp: <span className="font-mono text-white">{fmtVnd(data.forecast.next_session)}</span>
                </div>
                <div>
                  Cuối kỳ ({data.forecast.horizon_sessions} phiên):{" "}
                  <span className="font-mono text-white">{fmtVnd(data.forecast.horizon_end)}</span>
                </div>
                <div>
                  Độ dốc/phiên: <span className="font-mono">{fmtVnd(data.forecast.slope_per_session)}</span>
                </div>
                <div>
                  Độ tin cậy: <span className="font-semibold uppercase">{data.forecast.confidence}</span>
                </div>
                <p className="text-xs text-muted">
                  Dự báo dựa trên xu hướng tuyến tính ngắn hạn, chỉ dùng tham khảo cá nhân.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
