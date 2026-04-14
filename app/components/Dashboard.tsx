"use client";

import type { WatchItem, User } from "@/lib/types";
import { formatCompactVn, formatPercent, formatStockDelta, formatStockPrice } from "@/lib/format";
import { comparableBuyPrice } from "@/lib/pnl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LogoutButton } from "./LogoutButton";
import { ScheduleBoard } from "./ScheduleBoard";
import type { QuoteView } from "./StockTicker";
import { StockTickerList, CompactStockTickerRow } from "./StockTicker";
import { NewsFeed } from "./NewsFeed";
import { FileManager } from "./FileManager";

function getRoleDisplay(role: string): { label: string; color: string } {
  switch (role) {
    case "super_admin":
      return { label: "Super Admin", color: "text-amber-400" };
    case "admin":
      return { label: "Quản trị", color: "text-emerald-400" };
    case "manager":
      return { label: "Quản lý", color: "text-blue-400" };
    case "viewer":
    case "user":
    default:
      return { label: "Người xem", color: "text-slate-400" };
  }
}

export function Dashboard() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteView>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [sessionLabel, setSessionLabel] = useState("");
  const [storageOk, setStorageOk] = useState(true);
  const [lastQuoteUpdate, setLastQuoteUpdate] = useState<string>("");
  const [mockPricesEnabled, setMockPricesEnabled] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email: string; role: string } | null>(null);
  const [watchlistView, setWatchlistView] = useState<"cards" | "compact">("compact");
  const [showAddStock, setShowAddStock] = useState(false);
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const [symbolInput, setSymbolInput] = useState("");

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

  const checkMockPrices = useCallback(async () => {
    try {
      const r = await fetch("/api/config/telegram");
      if (!r.ok) return;
      const j = (await r.json()) as { mock_prices?: boolean; currentUser?: { uid: string; role: string } | null };
      setMockPricesEnabled(j.mock_prices === true);
      if (j.currentUser) {
        setCurrentUser({ email: j.currentUser.uid, role: j.currentUser.role });
      }
    } catch {
      // Ignore errors
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
    void checkMockPrices();
  }, [refreshList, refreshHealth, checkMockPrices]);

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

  useEffect(() => {
    const t = setInterval(() => void checkMockPrices(), 30_000);
    return () => clearInterval(t);
  }, [checkMockPrices]);

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
              Real-time stock tracking with FireAnt • TCBS • VNDirect
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Current User Info */}
            {currentUser && (
              <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5">
                <span className="text-slate-400">👤</span>
                <span className="text-sm text-slate-200">{currentUser.email}</span>
                <span className={`text-xs ${getRoleDisplay(currentUser.role).color}`}>
                  ({getRoleDisplay(currentUser.role).label})
                </span>
              </div>
            )}
            <a href="/settings" className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-600 hover:text-white transition-colors">
              Settings
            </a>
            <LogoutButton />
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {mockPricesEnabled && (
            <a 
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
              title="Click để tắt giá giả lập trong Settings"
            >
              ⚠️ Giá giả lập đang bật
              <span className="text-[10px] opacity-75">(Tắt)</span>
            </a>
          )}
          {!storageOk && (
            <span className="inline-flex rounded-full border border-rose-500/50 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400">
              ⚠️ Redis not connected
            </span>
          )}
          {lastQuoteUpdate && (
            <span className="inline-flex rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs text-slate-400 font-mono">
              🔄 {lastQuoteUpdate}
            </span>
          )}
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs text-slate-400">
            <span className="text-emerald-400">●</span> FireAnt RT
            <span className="text-blue-400">●</span> TCBS RT
            <span className="text-purple-400">●</span> VNDirect RT
          </span>
        </div>
      </header>

      {/* Watchlist Section */}
      <section className="mb-8">
        {/* Stats Summary */}
        {items.length > 0 && (
          <div className="mb-4 grid grid-cols-3 gap-2">
            {(() => {
              let upCount = 0, downCount = 0, avgPnlPct = 0, withBuyPriceCount = 0;
              items.forEach((item) => {
                const q = quotes[item.symbol];
                if (q) {
                  if (q.change >= 0) upCount++; else downCount++;
                  if (item.buy_price && q.price) {
                    const buy = comparableBuyPrice(Number(item.buy_price), q.price);
                    avgPnlPct += ((q.price - buy) / buy) * 100;
                    withBuyPriceCount++;
                  }
                }
              });
              const avgPnl = withBuyPriceCount > 0 ? avgPnlPct / withBuyPriceCount : 0;
              return (
                <>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2">
                    <div className="text-[10px] text-slate-500 uppercase">Tổng mã</div>
                    <div className="text-lg font-bold text-slate-200">{items.length}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2">
                    <div className="text-[10px] text-slate-500 uppercase">Tăng/Giảm</div>
                    <div className="text-lg font-bold">
                      <span className="text-emerald-400">{upCount}</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className="text-rose-400">{downCount}</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2">
                    <div className="text-[10px] text-slate-500 uppercase">Lãi/Lỗ TB</div>
                    <div className={`text-lg font-bold ${avgPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {withBuyPriceCount > 0 ? `${avgPnl >= 0 ? "+" : ""}${formatPercent(avgPnl)}` : "—"}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Quick Stock Chips */}
        {items.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {items.slice(0, 10).map((item) => {
              const q = quotes[item.symbol];
              const up = q ? q.change >= 0 : true;
              return (
                <a
                  key={item.id}
                  href={`/stocks/${encodeURIComponent(item.symbol)}`}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] transition-colors ${
                    up ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {item.symbol}
                  {q && <span>{up ? "↑" : "↓"}{formatPercent(q.change_pct)}</span>}
                </a>
              );
            })}
            {items.length > 10 && (
              <span className="inline-flex rounded-full bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-400">+{items.length - 10} mã</span>
            )}
          </div>
        )}

        {/* Header with View Toggle */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-200">Watchlist</h2>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex gap-1 rounded-lg bg-slate-800/50 p-0.5">
              <button
                onClick={() => setWatchlistView("compact")}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${watchlistView === "compact" ? "bg-slate-700 text-slate-200" : "text-slate-500 hover:text-slate-300"}`}
              >
                Bảng
              </button>
              <button
                onClick={() => setWatchlistView("cards")}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${watchlistView === "cards" ? "bg-slate-700 text-slate-200" : "text-slate-500 hover:text-slate-300"}`}
              >
                Cards
              </button>
            </div>
            {/* Add Button */}
            <button
              onClick={() => setShowAddStock(!showAddStock)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              {showAddStock ? "✕" : "+ Thêm"}
            </button>
          </div>
        </div>

        {/* Add Stock Form */}
        {showAddStock && (
          <form
            className="mb-4 flex flex-wrap gap-2 items-start"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const symbol = String(fd.get("symbol") ?? "").trim();
              const priceStr = String(fd.get("buy_price") ?? "").trim();
              if (symbol) {
                await onAdd(symbol, priceStr ? parseFloat(priceStr) : undefined);
                setShowAddStock(false);
                setSymbolInput("");
                setSuggestedPrice(null);
                e.currentTarget.reset();
              }
            }}
          >
            <div className="flex flex-col gap-1">
              <input
                name="symbol"
                value={symbolInput}
                onChange={async (e) => {
                  const val = e.target.value.trim().toUpperCase();
                  setSymbolInput(val);
                  if (val.length >= 3) {
                    try {
                      const r = await fetch(`/api/stocks/${encodeURIComponent(val)}/price`);
                      if (r.ok) {
                        const data = await r.json();
                        setSuggestedPrice(data.price);
                      } else {
                        setSuggestedPrice(null);
                      }
                    } catch {
                      setSuggestedPrice(null);
                    }
                  } else {
                    setSuggestedPrice(null);
                  }
                }}
                placeholder="Mã (VD: VCB)"
                className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 font-mono text-sm uppercase text-slate-100 outline-none w-[140px]"
                maxLength={20}
                required
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1">
              <input
                name="buy_price"
                type="number"
                step="0.01"
                min="0"
                placeholder={suggestedPrice ? `Giá thị trường: ${suggestedPrice.toFixed(2)}` : "Giá mua"}
                className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 font-mono text-sm text-slate-100 outline-none w-[160px]"
                autoComplete="off"
              />
              {suggestedPrice && (
                <button
                  type="button"
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.querySelector('input[name="buy_price"]') as HTMLInputElement;
                    if (input) input.value = suggestedPrice.toFixed(2);
                  }}
                  className="text-[10px] text-slate-400 hover:text-emerald-400 text-left"
                >
                  ⬅️ Dùng giá thị trường
                </button>
              )}
            </div>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Thêm</button>
          </form>
        )}

        {/* Watchlist Content */}
        {items.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
            <p className="text-slate-500 text-sm">Chưa có mã nào trong watchlist</p>
            <p className="text-slate-600 text-xs mt-1">Nhấn &quot;+ Thêm&quot; để bắt đầu</p>
          </div>
        ) : watchlistView === "cards" ? (
          <StockTickerList items={items} quotes={quotes} loadingIds={loading} onDelete={onDelete} />
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_100px_100px_60px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800 bg-slate-900/80">
              <div>Mã</div>
              <div>Giá / Thay đổi</div>
              <div className="text-right">Lãi/Lỗ</div>
              <div className="text-right">Nguồn</div>
              <div></div>
            </div>
            <div className="divide-y divide-slate-800/50">
              {items.map((item) => (
                <CompactStockTickerRow
                  key={item.id}
                  item={item}
                  quote={quotes[item.symbol] ?? null}
                  loading={loading[item.symbol] ?? false}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* News Feed - Two column layout */}
      <section className="mb-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main News Feed */}
          <div className="lg:col-span-2">
            <NewsFeed />
          </div>
          
          {/* Quick Stats / Mini Schedule */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Tin nóng gần đây
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-xs">
                  <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">💰</span>
                  <span className="text-slate-400">Fed báo hiệu cắt giảm lãi suất từ quý 3/2026</span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">🪙</span>
                  <span className="text-slate-400">Bitcoin vượt 95.000 USD nhờ mua vào từ tổ chức</span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">💻</span>
                  <span className="text-slate-400">Apple ra mắt tính năng AI cho iPhone 17</span>
                </div>
              </div>
            </div>
            
            {/* Market Hours */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h3 className="text-sm font-bold text-slate-200 mb-3">🕐 Giờ giao dịch</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">HOSE</span>
                  <span className="text-emerald-400">09:00 - 14:45</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">HNX</span>
                  <span className="text-emerald-400">09:00 - 14:45</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">UPCOM</span>
                  <span className="text-emerald-400">09:00 - 14:45</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* File Manager */}
      <section className="mb-8">
        <FileManager />
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
