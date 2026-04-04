"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCompactVn, formatNumberVn, formatPercent } from "@/lib/format";

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

type Tone = "good" | "warn" | "neutral";

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "week", label: "Tuần" },
  { id: "month", label: "Tháng" },
  { id: "quarter", label: "Quý" },
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

function toneClass(tone: Tone) {
  if (tone === "good") return "text-up";
  if (tone === "warn") return "text-down";
  return "text-slate-300";
}

function PriceChart({ points }: { points: HistoryPoint[] }) {
  const width = 920;
  const height = 340;
  const left = 64;
  const right = 18;
  const top = 20;
  const bottom = 44;
  const values = points.map((p) => p.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const chartW = width - left - right;
  const chartH = height - top - bottom;
  const dx = chartW / Math.max(1, points.length - 1);
  const yTicks = axisTicks(min, max, 5);
  const xTickIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1]
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const path = points
    .map((p, i) => {
      const x = left + i * dx;
      const y = top + ((max - p.close) / range) * chartH;
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
          {formatCompactVn(last)} ({formatPercent(first > 0 ? ((last - first) / first) * 100 : 0)})
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
        <defs>
          <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? "#2fd28b" : "#ff6b6b"} stopOpacity="0.95" />
            <stop offset="100%" stopColor={up ? "#2fd28b" : "#ff6b6b"} stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {yTicks.map((t) => {
          const y = top + ((max - t) / range) * chartH;
          return (
            <g key={`yt-${t}`}>
              <line x1={left} y1={y} x2={width - right} y2={y} stroke="rgba(148,167,196,0.18)" strokeWidth="1" />
              <text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="rgba(180,198,220,0.85)">
                {formatCompactVn(t)}
              </text>
            </g>
          );
        })}
        {xTickIndexes.map((idx) => {
          const x = left + idx * dx;
          return (
            <g key={`xt-${idx}`}>
              <line x1={x} y1={top} x2={x} y2={height - bottom} stroke="rgba(148,167,196,0.1)" strokeWidth="1" />
              <text x={x} y={height - 14} textAnchor="middle" fontSize="11" fill="rgba(180,198,220,0.85)">
                {dateShort(points[idx].date)}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="url(#lineGlow)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function VolumeBars({ points }: { points: HistoryPoint[] }) {
  const width = 920;
  const height = 220;
  const left = 64;
  const right = 18;
  const top = 16;
  const bottom = 36;
  const chartW = width - left - right;
  const chartH = height - top - bottom;
  const barW = chartW / Math.max(1, points.length);
  const maxVol = Math.max(...points.map((p) => p.volume), 1);
  const xTickIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1]
    .filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <div className="rounded-xl border border-line/70 bg-surface/40 p-3">
      <div className="mb-2 text-xs text-slate-300">Khối lượng giao dịch theo phiên</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
        {[0, maxVol / 2, maxVol].map((tick) => {
          const y = top + (1 - tick / maxVol) * chartH;
          return (
            <g key={`vt-${tick}`}>
              <line x1={left} y1={y} x2={width - right} y2={y} stroke="rgba(148,167,196,0.16)" strokeWidth="1" />
              <text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="rgba(180,198,220,0.85)">
                {formatCompactVn(tick)}
              </text>
            </g>
          );
        })}
        {points.map((p, i) => {
          const h = Math.max(2, (p.volume / maxVol) * chartH);
          const x = left + i * barW + 1;
          const y = top + chartH - h;
          return (
            <rect
              key={`${p.date}-vol`}
              x={x}
              y={y}
              width={Math.max(1, barW - 2)}
              height={h}
              rx={2}
              fill="rgba(56,168,255,0.74)"
            />
          );
        })}
        {xTickIndexes.map((idx) => {
          const x = left + idx * barW + barW / 2;
          return (
            <text key={`vx-${idx}`} x={x} y={height - 10} textAnchor="middle" fontSize="11" fill="rgba(180,198,220,0.85)">
              {dateShort(points[idx].date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function indicatorInsights(data: HistoryResponse) {
  const closes = data.points.map((p) => p.close);
  const price = closes[closes.length - 1];
  const out: string[] = [];
  const rsi = data.indicators.rsi14;
  if (rsi !== null) {
    if (rsi >= 70) out.push("RSI14 ở vùng cao, rủi ro quá mua.");
    else if (rsi <= 30) out.push("RSI14 ở vùng thấp, có thể quá bán.");
    else out.push("RSI14 trung tính, xung lực giá chưa cực đoan.");
  }
  const ema12 = data.indicators.ema12;
  const ema26 = data.indicators.ema26;
  if (ema12 !== null && ema26 !== null) {
    out.push(ema12 >= ema26 ? "EMA12 nằm trên EMA26: xu hướng ngắn hạn đang mạnh hơn." : "EMA12 dưới EMA26: xu hướng ngắn hạn đang yếu.");
  }
  const sma20 = data.indicators.sma20;
  if (sma20 !== null) {
    out.push(price >= sma20 ? "Giá hiện trên SMA20: thiên hướng tích cực trong kỳ." : "Giá hiện dưới SMA20: thiên hướng thận trọng trong kỳ.");
  }
  const macd = data.indicators.macd;
  const signal = data.indicators.signal9;
  if (macd !== null && signal !== null) {
    out.push(macd >= signal ? "MACD nằm trên Signal: động lượng tăng đang chiếm ưu thế." : "MACD dưới Signal: động lượng giảm đang chiếm ưu thế.");
  }
  return out;
}

function indicatorRows(data: HistoryResponse): Array<{ key: string; value: string; note: string; tone: Tone }> {
  const closes = data.points.map((p) => p.close);
  const price = closes[closes.length - 1];
  const rows: Array<{ key: string; value: string; note: string; tone: Tone }> = [];

  const sma20 = data.indicators.sma20;
  if (sma20 !== null) {
    const above = price >= sma20;
    rows.push({
      key: "SMA20",
      value: formatCompactVn(sma20),
      note: above ? "Giá đang nằm trên SMA20 (tín hiệu tích cực)." : "Giá dưới SMA20 (cần thận trọng xu hướng).",
      tone: above ? "good" : "warn",
    });
  }

  const ema12 = data.indicators.ema12;
  const ema26 = data.indicators.ema26;
  if (ema12 !== null && ema26 !== null) {
    const up = ema12 >= ema26;
    rows.push({
      key: "EMA12/EMA26",
      value: `${formatCompactVn(ema12)} / ${formatCompactVn(ema26)}`,
      note: up ? "EMA12 > EMA26: xu hướng ngắn hạn tích cực." : "EMA12 < EMA26: xu hướng ngắn hạn suy yếu.",
      tone: up ? "good" : "warn",
    });
  }

  const rsi = data.indicators.rsi14;
  if (rsi !== null) {
    const tone: Tone = rsi >= 70 ? "warn" : rsi <= 30 ? "good" : "neutral";
    const note =
      rsi >= 70 ? "RSI14 cao, có rủi ro quá mua." : rsi <= 30 ? "RSI14 thấp, có thể xuất hiện lực hồi." : "RSI14 trung tính.";
    rows.push({ key: "RSI14", value: formatCompactVn(rsi), note, tone });
  }

  const macd = data.indicators.macd;
  const signal = data.indicators.signal9;
  if (macd !== null && signal !== null) {
    const up = macd >= signal;
    rows.push({
      key: "MACD/Signal",
      value: `${formatCompactVn(macd)} / ${formatCompactVn(signal)}`,
      note: up ? "MACD trên Signal: động lượng tăng tốt." : "MACD dưới Signal: động lượng giảm chiếm ưu thế.",
      tone: up ? "good" : "warn",
    });
  }
  return rows;
}

function forecastAnalysis(
  selected: HistoryResponse,
  all: Partial<Record<Period, HistoryResponse>>,
): Array<{ text: string; tone: Tone }> {
  const out: Array<{ text: string; tone: Tone }> = [];
  const last = selected.points[selected.points.length - 1]?.close ?? 0;
  const expectedPct = last > 0 ? ((selected.forecast.horizon_end - last) / last) * 100 : 0;
  out.push({
    text:
      expectedPct >= 0
        ? `Kỳ ${selected.period}: mô hình đang kỳ vọng tăng khoảng ${formatPercent(expectedPct)} đến cuối kỳ.`
        : `Kỳ ${selected.period}: mô hình đang cảnh báo giảm khoảng ${formatPercent(expectedPct)} đến cuối kỳ.`,
    tone: expectedPct >= 0 ? "good" : "warn",
  });

  const slopes = PERIODS.map((p) => all[p.id]?.forecast.slope_per_session).filter(
    (x): x is number => typeof x === "number" && Number.isFinite(x),
  );
  if (slopes.length >= 2) {
    const positive = slopes.filter((x) => x > 0).length;
    const negative = slopes.filter((x) => x < 0).length;
    if (positive === slopes.length) {
      out.push({ text: "Đa kỳ đều nghiêng tăng (tuần-tháng-quý-năm cùng chiều).", tone: "good" });
    } else if (negative === slopes.length) {
      out.push({ text: "Đa kỳ cùng chiều giảm, rủi ro tiếp diễn xu hướng giảm.", tone: "warn" });
    } else {
      out.push({ text: "Các kỳ đang trái chiều, xác suất nhiễu cao nên quản trị vị thế chặt.", tone: "neutral" });
    }
  }

  if (selected.stats.volatility_pct >= 35) {
    out.push({ text: "Độ biến động cao (>35% năm hoá), nên ưu tiên kịch bản phòng thủ.", tone: "warn" });
  } else if (selected.stats.volatility_pct <= 18) {
    out.push({ text: "Độ biến động thấp, xu hướng có tính ổn định tương đối.", tone: "good" });
  } else {
    out.push({ text: "Độ biến động trung bình, cần theo dõi xác nhận thêm theo phiên gần nhất.", tone: "neutral" });
  }

  const cf = selected.forecast.confidence;
  out.push({
    text:
      cf === "high"
        ? "Độ tin cậy mô hình đang cao."
        : cf === "medium"
          ? "Độ tin cậy mô hình ở mức trung bình."
          : "Độ tin cậy mô hình thấp, chỉ dùng như kịch bản tham khảo.",
    tone: cf === "high" ? "good" : cf === "low" ? "warn" : "neutral",
  });

  return out;
}

export default function StockDetailPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [allPeriods, setAllPeriods] = useState<Partial<Record<Period, HistoryResponse>>>({});

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
  const rows = useMemo(() => (data ? indicatorRows(data) : []), [data]);
  const analyses = useMemo(() => (data ? forecastAnalysis(data, allPeriods) : []), [data, allPeriods]);

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
          <p className="text-xs text-slate-400">Dữ liệu gần nhất theo bộ lọc: {periodRange}</p>
          <section className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-line/70 bg-surface/35 p-3">
              <div className="text-xs text-muted">Giá đóng cửa gần nhất</div>
              <div className="mt-1 font-mono text-lg text-white" title={formatNumberVn(latest?.close)}>
                {formatCompactVn(latest?.close)}
              </div>
            </div>
            <div className="rounded-xl border border-line/70 bg-surface/35 p-3">
              <div className="text-xs text-muted">Biến động kỳ</div>
              <div className={`mt-1 font-mono text-lg ${data.stats.period_change_pct >= 0 ? "text-up" : "text-down"}`}>
                {formatPercent(data.stats.period_change_pct)}
              </div>
            </div>
            <div className="rounded-xl border border-line/70 bg-surface/35 p-3">
              <div className="text-xs text-muted">Khối lượng trung bình</div>
              <div className="mt-1 font-mono text-lg text-white" title={formatNumberVn(data.stats.avg_volume)}>
                {formatCompactVn(data.stats.avg_volume)}
              </div>
            </div>
            <div className="rounded-xl border border-line/70 bg-surface/35 p-3">
              <div className="text-xs text-muted">Độ biến động năm hoá</div>
              <div className="mt-1 font-mono text-lg text-white">{formatPercent(data.stats.volatility_pct)}</div>
            </div>
          </section>

          <PriceChart points={data.points} />
          <VolumeBars points={data.points} />

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-line/70 bg-surface/35 p-4">
              <h2 className="text-base font-bold text-white">Chỉ báo kỹ thuật</h2>
              <div className="mt-3 space-y-2 text-sm">
                {rows.map((r) => (
                  <div key={r.key} className="rounded-lg border border-line/60 bg-surface/35 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">{r.key}</span>
                      <span className={`font-mono ${toneClass(r.tone)}`}>{r.value}</span>
                    </div>
                    <p className={`mt-1 text-xs ${toneClass(r.tone)}`}>{r.note}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-300">
                {indicatorInsights(data).map((line) => (
                  <p key={line}>• {line}</p>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-line/70 bg-surface/35 p-4">
              <h2 className="text-base font-bold text-white">Dự báo xu hướng</h2>
              <div className="mt-3 grid gap-2 text-sm">
                <div>
                  Phiên kế tiếp:{" "}
                  <span className="font-mono text-white" title={formatNumberVn(data.forecast.next_session)}>
                    {formatCompactVn(data.forecast.next_session)}
                  </span>
                </div>
                <div>
                  Cuối kỳ ({data.forecast.horizon_sessions} phiên):{" "}
                  <span className="font-mono text-white" title={formatNumberVn(data.forecast.horizon_end)}>
                    {formatCompactVn(data.forecast.horizon_end)}
                  </span>
                </div>
                <div>
                  Độ dốc/phiên: <span className="font-mono">{formatCompactVn(data.forecast.slope_per_session)}</span>
                </div>
                <div>
                  Độ tin cậy:{" "}
                  <span
                    className={`font-semibold uppercase ${
                      data.forecast.confidence === "high"
                        ? "text-up"
                        : data.forecast.confidence === "low"
                          ? "text-down"
                          : "text-slate-300"
                    }`}
                  >
                    {data.forecast.confidence}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {analyses.map((a, idx) => (
                    <p key={`ana-${idx}`} className={`text-xs ${toneClass(a.tone)}`}>
                      • {a.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line/70 bg-surface/35 p-4">
            <h2 className="text-base font-bold text-white">Thống kê dự báo theo kỳ</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2">Kỳ lọc</th>
                    <th className="pb-2">Biến động kỳ</th>
                    <th className="pb-2">Phiên kế tiếp</th>
                    <th className="pb-2">Cuối kỳ dự báo</th>
                    <th className="pb-2">Độ dốc/phiên</th>
                    <th className="pb-2">Tin cậy</th>
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((p) => {
                    const row = allPeriods[p.id];
                    return (
                      <tr key={`forecast-${p.id}`} className="border-t border-line/60">
                        <td className="py-2 font-semibold text-slate-100">{p.label}</td>
                        <td className={`py-2 ${row && row.stats.period_change_pct >= 0 ? "text-up" : "text-down"}`}>
                          {row ? formatPercent(row.stats.period_change_pct) : "—"}
                        </td>
                        <td className="py-2 font-mono">{row ? formatCompactVn(row.forecast.next_session) : "—"}</td>
                        <td className={`py-2 font-mono ${row && row.forecast.horizon_end >= row.points[row.points.length - 1].close ? "text-up" : "text-down"}`}>
                          {row ? formatCompactVn(row.forecast.horizon_end) : "—"}
                        </td>
                        <td className={`py-2 font-mono ${row && row.forecast.slope_per_session >= 0 ? "text-up" : "text-down"}`}>
                          {row ? formatCompactVn(row.forecast.slope_per_session) : "—"}
                        </td>
                        <td
                          className={`py-2 uppercase ${
                            row
                              ? row.forecast.confidence === "high"
                                ? "text-up"
                                : row.forecast.confidence === "low"
                                  ? "text-down"
                                  : "text-slate-300"
                              : "text-slate-400"
                          }`}
                        >
                          {row ? row.forecast.confidence : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
