"use client";

import type { WatchItem } from "@/lib/types";
import { StockCard, type QuoteView } from "./StockCard";

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
  return (
    <section className="rounded-2xl p-5 glass-card md:p-6">
      <h2 className="text-lg font-bold tracking-wide text-white">MÃ CK:</h2>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.slice(0, 3).map((item) => (
            <span
              key={`chip-${item.id}`}
              className="inline-flex rounded-full soft-pill px-2.5 py-1 font-mono text-xs text-slate-200"
            >
              {item.symbol}
            </span>
          ))}
          {items.length > 3 && (
            <span className="inline-flex rounded-full soft-pill px-2.5 py-1 text-xs text-slate-300">
              +{items.length - 3} mã
            </span>
          )}
        </div>
      )}
      <form
        className="mt-4 flex flex-wrap gap-2"
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
        }}
      >
        <input
          name="symbol"
          placeholder="Mã cổ phiếu (vd: VCB, FPT)"
          className="neo-input min-w-[200px] flex-1 rounded-lg px-3 py-2 font-mono text-sm uppercase text-slate-100 outline-none"
          maxLength={20}
          required
          autoComplete="off"
        />
        <input
          name="buy_price"
          type="number"
          step="0.01"
          min="0"
          placeholder="Giá đã mua (tuỳ chọn)"
          className="neo-input w-[220px] rounded-lg px-3 py-2 font-mono text-sm text-slate-100 outline-none"
          autoComplete="off"
        />
        <button
          type="submit"
          className="brand-btn rounded-lg px-4 py-2 text-sm font-semibold text-white"
        >
          Thêm
        </button>
      </form>
      <p className="mt-2 text-xs text-slate-400">
        Chỉ cần mã — hỗ trợ HOSE/HNX/UPCOM. Nếu Yahoo không có metadata thì vẫn thêm được bằng thông tin mặc định.
      </p>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          Chưa có mã nào. Nhập mã (vd: VCB) để xem giá và nhận báo cáo Telegram.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line/70 bg-surface/30 p-2">
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
    </section>
  );
}
