"use client";

import type { WatchItem } from "@/lib/types";
import { formatCompactVn, formatNumberVn, formatPercent, formatStockDelta, formatStockPrice } from "@/lib/format";
import { comparableBuyPrice } from "@/lib/pnl";
import { lookupCompanyNameVi } from "@/lib/company-vi";

export type QuoteView = {
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  source: string;
} | null;

function getSourceColor(source: string): string {
  switch (source) {
    case "fireant":
      return "text-emerald-400";
    case "tcbs":
      return "text-blue-400";
    case "yahoo":
      return "text-slate-500";
    case "mock_demo":
      return "text-amber-400";
    default:
      return "text-slate-400";
  }
}

function getSourceLabel(source: string): string {
  switch (source) {
    case "fireant":
      return "FA";
    case "tcbs":
      return "TCBS";
    case "yahoo":
      return "Y!";
    case "mock_demo":
      return "DEMO";
    default:
      return source.toUpperCase();
  }
}

export function StockTickerCard({
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
  const colorClass = quote ? (up ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30") : "bg-slate-800/50 border-slate-700/50";
  const priceColor = quote ? (up ? "text-emerald-400" : "text-rose-400") : "text-slate-400";
  const arrow = quote ? (up ? "▲" : "▼") : "";
  
  const hasBuyPrice = Number.isFinite(item.buy_price);
  const buyPrice = hasBuyPrice ? Number(item.buy_price) : undefined;
  const normalizedBuyPrice = quote && buyPrice ? comparableBuyPrice(buyPrice, quote.price) : buyPrice;
  const hasPnl = Boolean(quote && normalizedBuyPrice);
  const pnlValue = hasPnl && quote && normalizedBuyPrice ? quote.price - normalizedBuyPrice : null;
  const pnlPct = hasPnl && quote && normalizedBuyPrice ? ((quote.price - normalizedBuyPrice) / normalizedBuyPrice) * 100 : null;
  const pnlUp = pnlValue !== null ? pnlValue >= 0 : true;

  const viName = item.display_name_vi || lookupCompanyNameVi(item.symbol);
  const sourceColor = getSourceColor(quote?.source ?? "");
  const sourceLabel = getSourceLabel(quote?.source ?? "");

  return (
    <div className={`relative overflow-hidden rounded-xl border ${colorClass} p-4 transition-all duration-200 hover:scale-[1.02]`}>
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      
      {/* Header: Symbol & Source */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-2xl font-black tracking-tight font-mono text-white">
            {item.symbol}
          </h3>
          <p className="text-xs text-slate-400 truncate max-w-[180px]" title={item.display_name}>
            {item.display_name}
          </p>
          {viName && (
            <p className="text-[10px] text-slate-500 truncate max-w-[180px]">
              {viName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {loading && (
            <span className="animate-pulse text-xs text-slate-500">●</span>
          )}
          {quote && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900/80 ${sourceColor}`}>
              {sourceLabel}
            </span>
          )}
          <button
            onClick={() => onDelete(item.id)}
            className="text-slate-600 hover:text-rose-400 transition-colors text-xs"
            title="Xóa"
          >
            ×
          </button>
        </div>
      </div>

      {/* Price Section */}
      <div className="space-y-1">
        {loading && !quote ? (
          <div className="h-10 flex items-center">
            <span className="text-slate-500 text-sm">Loading...</span>
          </div>
        ) : !quote ? (
          <div className="h-10 flex items-center">
            <span className="text-slate-500 text-sm">No data</span>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black font-mono tracking-tight ${priceColor}`}>
                {arrow} {formatStockPrice(quote.price)}
              </span>
            </div>
            <div className={`text-sm font-mono ${priceColor}`}>
              {formatStockDelta(quote.change)} ({formatPercent(quote.change_pct)})
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Vol: {formatCompactVn(quote.volume)}
            </div>
          </>
        )}
      </div>

      {/* PnL Section (if buy price set) */}
      {hasPnl && pnlValue !== null && (
        <div className={`mt-3 pt-3 border-t border-white/10 text-xs font-mono ${pnlUp ? "text-emerald-400" : "text-rose-400"}`}>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Buy: {formatStockPrice(normalizedBuyPrice!)}</span>
            <span>{pnlUp ? "+" : ""}{formatCompactVn(pnlValue)} ({formatPercent(pnlPct ?? 0)})</span>
          </div>
        </div>
      )}
      {hasBuyPrice && !hasPnl && (
        <div className="mt-3 pt-3 border-t border-white/10 text-xs text-slate-500">
          Buy: {formatStockPrice(buyPrice)} — Waiting price data
        </div>
      )}
    </div>
  );
}

export function StockTickerList({
  items,
  quotes,
  loadingIds,
  onDelete,
}: {
  items: WatchItem[];
  quotes: Record<string, QuoteView>;
  loadingIds: Record<string, boolean>;
  onDelete: (id: string) => void;
}) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <p className="text-slate-500 text-sm">No stocks in watchlist</p>
        <p className="text-slate-600 text-xs mt-1">Add a stock symbol to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {items.map((item) => (
        <StockTickerCard
          key={item.id}
          item={item}
          quote={quotes[item.symbol] ?? null}
          loading={loadingIds[item.symbol] ?? false}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
