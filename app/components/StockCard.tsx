"use client";

import type { WatchItem } from "@/lib/types";

export type QuoteView = {
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  source: string;
} | null;

export function StockCard({
  item,
  quote,
  loading,
  onDelete,
}: {
  item: WatchItem;
  quote: QuoteView;
  loading: boolean;
  onDelete: (id: string) => void;
}) {
  const up = quote ? quote.change >= 0 : true;
  const color = quote ? (up ? "text-up" : "text-down") : "text-muted";
  const hasBuyPrice = Number.isFinite(item.buy_price);
  const buyPrice = hasBuyPrice ? Number(item.buy_price) : undefined;
  const hasPnl = Boolean(quote && buyPrice);
  const pnlValue = hasPnl && quote && buyPrice ? quote.price - buyPrice : null;
  const pnlPct = hasPnl && quote && buyPrice ? ((quote.price - buyPrice) / buyPrice) * 100 : null;
  const pnlUp = pnlValue !== null ? pnlValue >= 0 : true;
  const pnlColor = pnlValue !== null ? (pnlUp ? "text-up" : "text-down") : "text-muted";

  const sub = [item.short_name, item.full_exchange || item.exchange, item.yahoo_symbol]
    .filter(Boolean)
    .join(" · ");

  return (
    <tr className="border-b border-line/80">
      <td className="max-w-[280px] py-3 pr-3">
        <div className="font-medium leading-snug text-slate-100">{item.display_name}</div>
        {sub ? (
          <div className="mt-0.5 text-xs leading-snug text-muted" title={sub}>
            {sub}
          </div>
        ) : null}
      </td>
      <td className="py-3 pr-2 font-mono font-semibold align-top">{item.symbol}</td>
      <td className="py-3 pr-2 text-sm align-top">
        {loading && <span className="text-muted">…</span>}
        {!loading && !quote && <span className="text-muted">—</span>}
        {!loading && quote && (
          <span>
            <span className="font-mono">{quote.price.toLocaleString("vi-VN")}</span>{" "}
            <span className={color}>
              ({up ? "+" : ""}
              {quote.change.toLocaleString("vi-VN")}, {up ? "+" : ""}
              {quote.change_pct.toFixed(2)}%)
            </span>
            {(quote.source === "mock_demo" || quote.source === "mock_fallback") && (
              <span className="ml-1 text-xs text-amber-200/90" title="Không phải giá sàn thật">
                {quote.source === "mock_demo"
                  ? "giả lập (cài đặt)"
                  : "thử nghiệm (API lỗi)"}
              </span>
            )}
          </span>
        )}
      </td>
      <td className="py-3 pr-2 text-sm align-top">
        {!buyPrice && <span className="text-muted">—</span>}
        {buyPrice && (
          <div>
            <div className="font-mono">{buyPrice.toLocaleString("vi-VN")}</div>
            {pnlValue === null || pnlPct === null ? (
              <div className="text-xs text-muted">Chưa có giá thị trường</div>
            ) : (
              <div className={`text-xs ${pnlColor}`}>
                {pnlUp ? "+" : ""}
                {pnlValue.toLocaleString("vi-VN")} ({pnlUp ? "+" : ""}
                {pnlPct.toFixed(2)}%)
              </div>
            )}
          </div>
        )}
      </td>
      <td className="py-3 text-right align-top">
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:border-down hover:text-down"
        >
          Xóa
        </button>
      </td>
    </tr>
  );
}
