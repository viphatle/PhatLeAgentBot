"use client";

import type { WatchItem } from "@/lib/types";
import { formatCompactVn, formatPercent } from "@/lib/format";
import { comparableBuyPrice } from "@/lib/pnl";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MobileStockCard, StockCard, CompactStockRow, type QuoteView } from "./StockCard";

function parseBuyPriceInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(/[_\s,]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export function WatchList({
  items,
  quotes,
  loadingIds,
  onAdd,
  onDelete,
}: {
  items: WatchItem[];
  quotes: Record<string, QuoteView>;
  loadingIds: Record<string, boolean>;
  onAdd: (symbol: string, buyPrice?: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [viewMode, setViewMode] = useState<"compact" | "detailed">("compact");
  const [showAddForm, setShowAddForm] = useState(false);

  // Calculate portfolio stats
  const stats = useMemo(() => {
    let totalInvested = 0;
    let totalCurrent = 0;
    let upCount = 0;
    let downCount = 0;
    let pnlSum = 0;
    let withDataCount = 0;

    items.forEach((item) => {
      const quote = quotes[item.symbol];
      const hasBuyPrice = Number.isFinite(item.buy_price);
      
      if (quote && hasBuyPrice) {
        const buyPrice = Number(item.buy_price);
        const normalizedBuyPrice = comparableBuyPrice(buyPrice, quote.price);
        // Estimate quantity based on investment (assuming fixed 10M VND per stock for display)
        const quantity = Math.floor(10000000 / normalizedBuyPrice);
        totalInvested += normalizedBuyPrice * quantity;
        totalCurrent += quote.price * quantity;
        const pnl = quote.price - normalizedBuyPrice;
        pnlSum += pnl * quantity;
        withDataCount++;
      }
      
      if (quote) {
        if (quote.change >= 0) upCount++;
        else downCount++;
      }
    });

    const pnlPct = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

    return {
      totalStocks: items.length,
      upCount,
      downCount,
      totalInvested,
      totalCurrent,
      pnlSum,
      pnlPct,
      withDataCount,
    };
  }, [items, quotes]);

  return (
    <section className="rounded-2xl p-5 glass-card md:p-6">
      <h2 className="text-lg font-bold tracking-wide text-white">
        THÔNG TIN CHỨNG KHOÁN:
      </h2>
      {/* Stats Summary Bar */}
      {items.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-2">
            <div className="text-[10px] text-slate-500 uppercase">Tổng mã</div>
            <div className="text-lg font-bold text-slate-200">{stats.totalStocks}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-2">
            <div className="text-[10px] text-slate-500 uppercase">Tăng/Giảm</div>
            <div className="text-lg font-bold">
              <span className="text-emerald-400">{stats.upCount}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-rose-400">{stats.downCount}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-2">
            <div className="text-[10px] text-slate-500 uppercase">Đã đầu tư</div>
            <div className="text-sm font-bold text-slate-200">
              {stats.totalInvested > 0 ? formatCompactVn(stats.totalInvested) : "—"}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-2">
            <div className="text-[10px] text-slate-500 uppercase">Lãi/Lỗ</div>
            <div className={`text-sm font-bold ${stats.pnlSum >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {stats.pnlSum !== 0 ? `${stats.pnlSum >= 0 ? "+" : ""}${formatCompactVn(stats.pnlSum)} (${formatPercent(stats.pnlPct)})` : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Quick Stock Chips */}
      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {items.slice(0, 8).map((item) => {
            const quote = quotes[item.symbol];
            const isUp = quote ? quote.change >= 0 : true;
            return (
              <Link
                key={`chip-${item.id}`}
                href={`/stocks/${encodeURIComponent(item.symbol)}`}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] sm:text-xs transition-colors ${
                  isUp 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" 
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                }`}
              >
                {item.symbol}
                {quote && (
                  <span>{isUp ? "↑" : "↓"}{formatPercent(quote.change_pct)}</span>
                )}
              </Link>
            );
          })}
          {items.length > 8 && (
            <span className="inline-flex rounded-full bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-400">
              +{items.length - 8} mã
            </span>
          )}
        </div>
      )}
      {/* Toggle Add Form */}
      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="mt-3 flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span>{showAddForm ? "▼" : "▶"}</span>
        <span>{showAddForm ? "Ẩn form thêm mã" : "Thêm mã cổ phiếu"}</span>
      </button>

      {showAddForm && (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            const symbol = String(fd.get("symbol") ?? "").trim();
            const rawBuyPrice = String(fd.get("buy_price") ?? "").trim();
            const buyPrice = parseBuyPriceInput(rawBuyPrice);
            if (!symbol) return;
            if (buyPrice !== undefined && (!Number.isFinite(buyPrice) || buyPrice <= 0)) {
              alert("Giá mua không hợp lệ");
              return;
            }
            await onAdd(symbol, buyPrice);
            form.reset();
            setShowAddForm(false);
          }}
        >
          <input
            name="symbol"
            placeholder="Mã (VD: VCB, FPT)"
            className="neo-input min-w-[140px] flex-1 rounded-lg px-3 py-2 font-mono text-sm uppercase text-slate-100 outline-none"
            maxLength={20}
            required
            autoComplete="off"
          />
          <input
            name="buy_price"
            type="number"
            step="0.01"
            min="0"
            placeholder="Giá mua (tùy chọn)"
            className="neo-input w-[160px] rounded-lg px-3 py-2 font-mono text-sm text-slate-100 outline-none"
            autoComplete="off"
          />
          <button
            type="submit"
            className="brand-btn rounded-lg px-4 py-2 text-sm font-semibold text-white"
          >
            Thêm
          </button>
        </form>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        Hỗ trợ HOSE/HNX/UPCOM. Nhập giá mua để tính lãi/lỗ.
      </p>

      {/* View Mode Toggle */}
      {items.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-slate-400">Danh sách mã theo dõi</div>
          <div className="flex gap-1 rounded-lg bg-slate-800/50 p-0.5">
            <button
              onClick={() => setViewMode("compact")}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                viewMode === "compact" 
                  ? "bg-slate-700 text-slate-200" 
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Gọn
            </button>
            <button
              onClick={() => setViewMode("detailed")}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                viewMode === "detailed" 
                  ? "bg-slate-700 text-slate-200" 
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Chi tiết
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          Chưa có mã nào. Nhập mã (vd: VCB) để xem giá và nhận báo cáo Telegram.
        </p>
      ) : (
        <div className="mt-3">
          {/* Mobile Cards */}
          <div className="grid gap-2 md:hidden">
            {items.map((item) => (
              <MobileStockCard
                key={`m-${item.id}`}
                item={item}
                quote={quotes[item.symbol] ?? null}
                loading={Boolean(loadingIds[item.symbol])}
                onDelete={(id) => void onDelete(id)}
              />
            ))}
          </div>

          {/* Desktop Table - Compact View */}
          {viewMode === "compact" ? (
            <div className="hidden md:block overflow-hidden rounded-xl border border-line/70 bg-surface/30">
              <div className="grid grid-cols-[1fr_80px_140px_100px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wide text-muted border-b border-line/50">
                <div>Công ty</div>
                <div>Giá</div>
                <div>Thay đổi</div>
                <div className="text-right">Lãi/Lỗ</div>
              </div>
              <div className="divide-y divide-line/30">
                {items.map((item) => (
                  <CompactStockRow
                    key={item.id}
                    item={item}
                    quote={quotes[item.symbol] ?? null}
                    loading={Boolean(loadingIds[item.symbol])}
                    onDelete={(id) => void onDelete(id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Desktop Table - Detailed View */
            <div className="hidden overflow-x-auto rounded-xl border border-line/70 bg-surface/30 p-2 md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 min-w-[200px]">Công ty</th>
                    <th className="pb-2">Mã</th>
                    <th className="pb-2">Giá / thay đổi</th>
                    <th className="pb-2">Giá mua / lãi lỗ</th>
                    <th className="pb-2 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <StockCard
                      key={item.id}
                      item={item}
                      quote={quotes[item.symbol] ?? null}
                      loading={Boolean(loadingIds[item.symbol])}
                      onDelete={(id) => void onDelete(id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
