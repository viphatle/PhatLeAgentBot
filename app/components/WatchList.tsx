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
    <section className="rounded-xl border border-line bg-card/90 p-5 shadow-lg backdrop-blur">
      <h2 className="text-lg font-semibold text-white">Danh sách theo dõi</h2>
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
          className="min-w-[200px] flex-1 rounded-lg border border-line bg-surface/80 px-3 py-2 font-mono text-sm uppercase outline-none ring-accent focus:ring-2"
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
          className="w-[220px] rounded-lg border border-line bg-surface/80 px-3 py-2 font-mono text-sm outline-none ring-accent focus:ring-2"
          autoComplete="off"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Thêm
        </button>
      </form>
      <p className="mt-2 text-xs text-muted">
        Chỉ cần mã — tên công ty và sàn lấy tự động từ Yahoo. Trùng mã sẽ báo lỗi.
      </p>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          Chưa có mã nào. Nhập mã (vd: VCB) để xem giá và nhận báo cáo Telegram.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
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
