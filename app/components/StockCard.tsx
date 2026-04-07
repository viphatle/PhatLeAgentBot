"use client";

import type { WatchItem } from "@/lib/types";
import { lookupCompanyNameVi } from "@/lib/company-vi";
import { formatCompactVn, formatNumberVn, formatPercent, formatStockDelta, formatStockPrice } from "@/lib/format";
import { comparableBuyPrice } from "@/lib/pnl";
import Link from "next/link";

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
  const normalizedBuyPrice = quote && buyPrice ? comparableBuyPrice(buyPrice, quote.price) : buyPrice;
  const hasPnl = Boolean(quote && normalizedBuyPrice);
  const pnlValue = hasPnl && quote && normalizedBuyPrice ? quote.price - normalizedBuyPrice : null;
  const pnlPct =
    hasPnl && quote && normalizedBuyPrice
      ? ((quote.price - normalizedBuyPrice) / normalizedBuyPrice) * 100
      : null;
  const pnlUp = pnlValue !== null ? pnlValue >= 0 : true;
  const pnlColor = pnlValue !== null ? (pnlUp ? "text-up" : "text-down") : "text-muted";
  const pnlLabel = pnlValue === null ? "" : pnlValue > 0 ? "Lãi" : pnlValue < 0 ? "Lỗ" : "Hòa vốn";

  const sub = [item.short_name, item.full_exchange || item.exchange, item.yahoo_symbol]
    .filter(Boolean)
    .join(" · ");
  const viName = item.display_name_vi || lookupCompanyNameVi(item.symbol);

  return (
    <tr className="border-b border-line/70 last:border-b-0">
      <td className="max-w-[280px] py-3 pr-3">
        <div className="font-semibold leading-snug text-slate-100">{item.display_name}</div>
        {viName ? <div className="mt-0.5 text-xs leading-snug text-slate-400">{viName}</div> : null}
        {sub ? (
          <div className="mt-0.5 text-xs leading-snug text-muted" title={sub}>
            {sub}
          </div>
        ) : null}
      </td>
      <td className="py-3 pr-2 font-mono font-semibold align-top">
        <Link href={`/stocks/${encodeURIComponent(item.symbol)}`} className="text-accent hover:underline">
          {item.symbol}
        </Link>
      </td>
      <td className="py-3 pr-2 text-sm align-top">
        {loading && <span className="text-muted">…</span>}
        {!loading && !quote && <span className="text-muted">—</span>}
        {!loading && quote && (
            <span>
              <span className="font-mono" title={`${formatNumberVn(quote.price)} VND`}>
                {formatStockPrice(quote.price)}
              </span>{" "}
              <span className={color}>
              ({formatStockDelta(quote.change)}, {formatPercent(quote.change_pct)})
              </span>
              <span className="ml-2 text-xs text-slate-400" title={formatNumberVn(quote.volume)}>
                KLGD: {formatCompactVn(quote.volume)}
              </span>
            {quote.source === "mock_demo" && (
              <span className="ml-1 text-xs text-amber-200/90" title="Không phải giá sàn thật">
                giả lập (cài đặt)
              </span>
            )}
          </span>
        )}
      </td>
      <td className="py-3 pr-2 text-sm align-top">
        {!buyPrice && <span className="text-muted">—</span>}
        {buyPrice && (
          <div>
            <div className="font-mono" title={formatNumberVn(buyPrice)}>
              {formatStockPrice(buyPrice)}
            </div>
            {pnlValue === null || pnlPct === null ? (
              <div className="text-xs text-muted">Chưa có giá thị trường</div>
            ) : (
              <div className={`text-xs ${pnlColor}`}>
                {pnlLabel}: {pnlUp ? "+" : ""}
                {formatCompactVn(pnlValue)} ({formatPercent(pnlPct)})
              </div>
            )}
          </div>
        )}
      </td>
      <td className="py-3 text-right align-top">
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="rounded-lg subtle-btn px-2 py-1 text-xs text-slate-300 hover:text-down"
        >
          Xóa
        </button>
      </td>
    </tr>
  );
}

export function MobileStockCard({
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
  const normalizedBuyPrice = quote && buyPrice ? comparableBuyPrice(buyPrice, quote.price) : buyPrice;
  const hasPnl = Boolean(quote && normalizedBuyPrice);
  const pnlValue = hasPnl && quote && normalizedBuyPrice ? quote.price - normalizedBuyPrice : null;
  const pnlPct =
    hasPnl && quote && normalizedBuyPrice
      ? ((quote.price - normalizedBuyPrice) / normalizedBuyPrice) * 100
      : null;
  const pnlUp = pnlValue !== null ? pnlValue >= 0 : true;
  const pnlColor = pnlValue !== null ? (pnlUp ? "text-up" : "text-down") : "text-muted";
  const pnlLabel = pnlValue === null ? "" : pnlValue > 0 ? "Lãi" : pnlValue < 0 ? "Lỗ" : "Hòa vốn";

  const sub = [item.short_name, item.full_exchange || item.exchange, item.yahoo_symbol]
    .filter(Boolean)
    .join(" · ");
  const viName = item.display_name_vi || lookupCompanyNameVi(item.symbol);

  return (
    <article className="rounded-xl border border-line/70 bg-surface/45 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/stocks/${encodeURIComponent(item.symbol)}`}
            className="font-mono text-sm font-bold text-accent hover:underline"
          >
            {item.symbol}
          </Link>
          <div className="mt-1 text-sm font-semibold leading-snug text-slate-100">{item.display_name}</div>
          {viName ? <div className="mt-0.5 text-xs leading-snug text-slate-400">{viName}</div> : null}
          {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
        </div>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="rounded-lg subtle-btn px-2 py-1 text-xs text-slate-300 hover:text-down"
        >
          Xóa
        </button>
      </div>

      <div className="mt-3 grid gap-2 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-muted">Giá thị trường</span>
          {loading && <span className="text-muted">…</span>}
          {!loading && !quote && <span className="text-muted">Không có dữ liệu</span>}
          {!loading && quote && (
            <span className="text-right">
              <span className="font-mono text-slate-100" title={`${formatNumberVn(quote.price)} VND`}>
                {formatStockPrice(quote.price)}
              </span>{" "}
              <span className={color}>
                ({formatStockDelta(quote.change)}, {formatPercent(quote.change_pct)})
              </span>
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-muted">Giá mua / lãi lỗ</span>
          {!buyPrice && <span className="text-muted">—</span>}
          {buyPrice && (
            <div className="text-right">
              <div className="font-mono text-slate-100" title={formatNumberVn(buyPrice)}>
                {formatStockPrice(buyPrice)}
              </div>
              {pnlValue === null || pnlPct === null ? (
                <div className="text-xs text-muted">Chưa có giá thị trường</div>
              ) : (
                <div className={`text-xs ${pnlColor}`}>
                  {pnlLabel}: {pnlUp ? "+" : ""}
                  {formatCompactVn(pnlValue)} ({formatPercent(pnlPct)})
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
