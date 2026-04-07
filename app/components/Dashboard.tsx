"use client";

import type { WatchItem } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";
import { LogoutButton } from "./LogoutButton";
import { ScheduleBoard } from "./ScheduleBoard";
import type { QuoteView } from "./StockTicker";
import { StockTickerList } from "./StockTicker";

export function Dashboard() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteView>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [sessionLabel, setSessionLabel] = useState("");
  const [storageOk, setStorageOk] = useState(true);
  const [lastQuoteUpdate, setLastQuoteUpdate] = useState<string>("");

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
    // Keep previous values while polling to avoid UI flicker.
    setLoading((prev) => {
      const next = { ...prev };
      for (const x of list) {
        if (next[x.symbol] === undefined) next[x.symbol] = true;
      }
      return next;
    });
    const updates: Record<string, QuoteView> = {};
    await Promise.all(
      list.map(async (w) => {
        try {
          const r = await fetch(
            `/api/stocks/${encodeURIComponent(w.symbol)}/price?ts=${Date.now()}`,
            { cache: "no-store" },
          );
          if (!r.ok) {
            return;
          }
          const data = (await r.json()) as {
            price: number;
            change: number;
            change_pct: number;
            volume: number;
            source: string;
          };
          updates[w.symbol] = {
            price: data.price,
            change: data.change,
            change_pct: data.change_pct,
            volume: data.volume,
            source: data.source,
          };
        } catch {
          // Keep previous quote on transient network failure.
        }
      })
    );
    setQuotes((prev) => ({ ...prev, ...updates }));
    setLastQuoteUpdate(new Date().toLocaleTimeString("vi-VN"));
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
    const t = setInterval(() => void loadQuotes(items), 2_000);
    return () => clearInterval(t);
  }, [items, loadQuotes]);

  useEffect(() => {
    const t = setInterval(() => void refreshHealth(), 60_000);
    return () => clearInterval(t);
  }, [refreshHealth]);

  const onDelete = useCallback(async (id: string) => {
    const r = await fetch("/api/stocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) return;
    await refreshList();
  }, [refreshList]);

  const onAdd = useCallback(async (symbol: string, buyPrice?: number) => {
    const r = await fetch("/api/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, buy_price: buyPrice }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j?.error ?? "Không thêm được");
      return;
    }
    await refreshList();
  }, [refreshList]);

  return (
    <main className="min-h-screen bg-[#0a0f1a] p-4 md:p-6">
      {/* Header */}
      <header className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:p-6 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl font-mono">
              📊 STOCK MONITOR
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Real-time stock tracking with FireAnt • TCBS • Yahoo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/settings" className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-600 hover:text-white transition-colors">
              Settings
            </a>
            <LogoutButton />
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!storageOk && (
            <span className="inline-flex rounded-full border border-rose-500/50 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400">
              ⚠ Redis not connected
            </span>
          )}
          {lastQuoteUpdate && (
            <span className="inline-flex rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs text-slate-400 font-mono">
              🔄 {lastQuoteUpdate}
            </span>
          )}
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs text-slate-400">
            <span className="text-emerald-400">●</span> FireAnt
            <span className="text-blue-400">●</span> TCBS
            <span className="text-slate-500">●</span> Yahoo
          </span>
        </div>
      </header>

      {/* Stock Grid */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-200">Watchlist</h2>
          <button
            onClick={() => {
              const symbol = prompt("Nhập mã cổ phiếu (VD: VCB, FPT, DPM):");
              const buyPrice = prompt("Giá mua (để trống nếu không có):");
              if (symbol) {
                void onAdd(symbol, buyPrice ? parseFloat(buyPrice) : undefined);
              }
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
          >
            + Thêm mã
          </button>
        </div>
        <StockTickerList
          items={items}
          quotes={quotes}
          loadingIds={loading}
          onDelete={onDelete}
        />
      </section>

      {/* Schedule */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-200">Lịch biểu</h2>
          <a href="/schedule" className="text-sm text-slate-400 hover:text-white transition-colors">
            Xem đầy đủ →
          </a>
        </div>
        <ScheduleBoard embedded />
      </section>
    </main>
  );
}
