"use client";

import type { WatchItem } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";
import { LogoutButton } from "./LogoutButton";
import { ScheduleBoard } from "./ScheduleBoard";
import type { QuoteView } from "./StockCard";
import { WatchList } from "./WatchList";

export function Dashboard() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteView>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [sessionLabel, setSessionLabel] = useState("");
  const [storageOk, setStorageOk] = useState(true);

  const refreshList = useCallback(async () => {
    try {
      const r = await fetch("/api/stocks");
      if (!r.ok) return;
      setItems(await r.json());
    } catch {
      // Network error (e.g. server restarting) -> keep current UI state.
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const r = await fetch("/api/health");
      if (!r.ok) return;
      const j = (await r.json()) as { storage_ready?: boolean };
      setSessionLabel("");
      setStorageOk(j.storage_ready !== false);
    } catch {
      // When health endpoint is temporarily unreachable, avoid crashing UI.
    }
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
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <header className="mb-8 rounded-2xl p-5 glass-card md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl">
            LỊCH BIỂU:
          </h1>
          <div className="flex items-center gap-2">
            <a
              href="/settings"
              className="rounded-lg subtle-btn px-3 py-1.5 text-sm text-slate-100"
            >
              Mở setting
            </a>
            <LogoutButton />
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          Nhắc lịch, theo dõi các sự kiện và hoạt động cá nhân.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {sessionLabel ? (
            <span className="inline-flex rounded-full soft-pill px-3 py-1 text-xs text-slate-200">
              {sessionLabel}
            </span>
          ) : null}
          {!storageOk && (
            <span className="inline-flex rounded-full border border-down/50 bg-down/10 px-3 py-1 text-xs font-semibold text-down">
              Vercel: chưa gắn Redis — không lưu được watchlist/settings. Thêm REDIS_URL và redeploy.
            </span>
          )}
        </div>
      </header>

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
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold tracking-tight text-white md:text-2xl">LỊCH BIỂU</h2>
          <a href="/schedule" className="rounded-lg subtle-btn px-3 py-1.5 text-sm text-slate-100">
            Mở toàn màn hình
          </a>
        </div>
        <ScheduleBoard embedded />
      </section>
    </main>
  );
}
