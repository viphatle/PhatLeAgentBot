"use client";

import type { WatchItem } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";
import { TelegramSetup } from "./TelegramSetup";
import type { QuoteView } from "./StockCard";
import { WatchList } from "./WatchList";

export function Dashboard() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteView>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [sessionLabel, setSessionLabel] = useState("…");
  const [storageOk, setStorageOk] = useState(true);

  const refreshList = useCallback(async () => {
    const r = await fetch("/api/stocks");
    if (!r.ok) return;
    setItems(await r.json());
  }, []);

  const refreshHealth = useCallback(async () => {
    const r = await fetch("/api/health");
    if (!r.ok) return;
    const j = (await r.json()) as { in_session?: boolean; storage_ready?: boolean };
    setSessionLabel(
      j.in_session
        ? "Đang trong phiên (GMT+7)"
        : "Ngoài phiên HOSE/HNX (T2–T6, 9h–11h30 & 13h–14h45)"
    );
    setStorageOk(j.storage_ready !== false);
  }, []);

  const loadQuotes = useCallback(async (list: WatchItem[]) => {
    const nextLoad: Record<string, boolean> = {};
    for (const x of list) nextLoad[x.symbol] = true;
    setLoading((prev) => ({ ...prev, ...nextLoad }));
    const q: Record<string, QuoteView> = {};
    await Promise.all(
      list.map(async (w) => {
        try {
          const r = await fetch(`/api/stocks/${encodeURIComponent(w.symbol)}/price`);
          if (!r.ok) {
            q[w.symbol] = null;
            return;
          }
          const data = (await r.json()) as {
            price: number;
            change: number;
            change_pct: number;
            volume: number;
            source: string;
          };
          q[w.symbol] = {
            price: data.price,
            change: data.change,
            change_pct: data.change_pct,
            volume: data.volume,
            source: data.source,
          };
        } catch {
          q[w.symbol] = null;
        }
      })
    );
    setQuotes(q);
    setLoading((prev) => {
      const copy = { ...prev };
      for (const w of list) copy[w.symbol] = false;
      return copy;
    });
  }, []);

  useEffect(() => {
    void refreshList();
    void refreshHealth();
  }, [refreshList, refreshHealth]);

  useEffect(() => {
    if (!items.length) return;
    void loadQuotes(items);
    const t = setInterval(() => void loadQuotes(items), 30_000);
    return () => clearInterval(t);
  }, [items, loadQuotes]);

  useEffect(() => {
    const t = setInterval(() => void refreshHealth(), 60_000);
    return () => clearInterval(t);
  }, [refreshHealth]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          DANH SÁCH CHỨNG KHOÁN
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Next.js serverless trên Vercel — watchlist/settings lưu trên Redis. Giá thị trường:{" "}
          <strong className="text-slate-300">Yahoo Finance</strong> (mã dạng VCB → VCB.VN), sau đó TCBS,
          VNDIRECT nếu cần. Dữ liệu Yahoo có thể trễ vài phút so với sàn; không phải bảng giá niêm yết chính thức.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-line bg-card px-3 py-1 text-xs text-slate-200">
            {sessionLabel}
          </span>
          {!storageOk && (
            <span className="inline-flex rounded-full border border-down/50 bg-down/10 px-3 py-1 text-xs text-down">
              Vercel: chưa gắn Redis — không lưu được watchlist/settings. Thêm REDIS_URL và redeploy.
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-6">
        <WatchList
          items={items}
          quotes={quotes}
          loadingIds={loading}
          onAdd={async (symbol, buyPrice) => {
            const r = await fetch("/api/stocks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                symbol,
                buy_price: buyPrice,
              }),
            });
            if (!r.ok) {
              const j = await r.json().catch(() => ({}));
              alert(j?.error ?? "Không thêm được");
              return;
            }
            await refreshList();
          }}
          onDelete={async (id) => {
            const r = await fetch("/api/stocks", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            });
            if (!r.ok) return;
            await refreshList();
          }}
        />
        <TelegramSetup onSaved={() => void refreshList()} />
      </div>
    </main>
  );
}
