"use client";

import { useEffect, useState, useCallback } from "react";

export type NewsCategory = "finance" | "crypto" | "tech" | "economy";

type NewsItem = {
  id: string;
  title: string;
  titleVi?: string;
  summary?: string;
  summaryVi?: string;
  url: string;
  source: string;
  category: NewsCategory;
  publishedAt: string;
  relativeTime: string;
  imageUrl?: string;
  lang: "vi" | "en";
};

const CATEGORY_CONFIG: Record<NewsCategory, { label: string; color: string; icon: string }> = {
  finance: { label: "Tài chính", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: "💰" },
  crypto: { label: "Tiền số", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: "🪙" },
  tech: { label: "Công nghệ", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: "💻" },
  economy: { label: "Kinh tế", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: "📊" },
};

function getDomainFromUrl(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return domain;
  } catch {
    return url;
  }
}

function translateButton(url: string): string {
  // Google Translate link
  const encoded = encodeURIComponent(url);
  return `https://translate.google.com/translate?sl=en&tl=vi&u=${encoded}`;
}

export function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      const url = selectedCategory 
        ? `/api/news?category=${selectedCategory}` 
        : "/api/news";
      
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch");
      
      const data = await res.json();
      setNews(data.news || []);
      setLastUpdate(new Date().toLocaleTimeString("vi-VN"));
      setError(null);
    } catch (err) {
      setError("Không thể tải tin tức");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchNews();
    // Auto refresh every 2 minutes
    const interval = setInterval(fetchNews, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const categories: (NewsCategory | null)[] = [null, "finance", "crypto", "tech", "economy"];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">NEWS FEED</h2>
            <p className="text-xs text-slate-500">
              Cập nhật: {lastUpdate || "--:--"}
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchNews()}
          disabled={loading}
          className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
        >
          {loading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            "🔄 Làm mới"
          )}
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((cat) => (
          <button
            key={cat || "all"}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              selectedCategory === cat
                ? "bg-slate-700 text-white border border-slate-600"
                : "bg-slate-800/30 text-slate-400 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-300"
            }`}
          >
            {cat ? (
              <>
                {CATEGORY_CONFIG[cat].icon} {CATEGORY_CONFIG[cat].label}
              </>
            ) : (
              "📰 Tất cả"
            )}
          </button>
        ))}
      </div>

      {/* News List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {loading && news.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <span className="text-3xl mb-2 block">⚠️</span>
            <p className="text-sm text-slate-400">{error}</p>
            <button
              onClick={fetchNews}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300"
            >
              Thử lại
            </button>
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-3xl mb-2 block">📭</span>
            <p className="text-sm text-slate-400">Chưa có tin tức</p>
          </div>
        ) : (
          news.map((item) => {
            const isExpanded = expandedId === item.id;
            const category = CATEGORY_CONFIG[item.category];
            const isEnglish = item.lang === "en";
            const displayTitle = item.titleVi || item.title;
            const displaySummary = item.summaryVi || item.summary;
            const domain = getDomainFromUrl(item.url);
            
            return (
              <article
                key={item.id}
                className={`group rounded-xl border p-3.5 transition-all hover:scale-[1.01] ${
                  isExpanded 
                    ? "bg-slate-800/60 border-slate-600" 
                    : "bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50 hover:border-slate-600"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Category Icon */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm border ${category.color}`}>
                    {category.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Source & Time */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <span className="font-medium text-slate-400">{item.source}</span>
                      <span>•</span>
                      <span>{item.relativeTime}</span>
                      {isEnglish && (
                        <>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px]">EN</span>
                        </>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold text-slate-200 leading-snug mb-1">
                      {displayTitle}
                    </h3>

                    {/* Summary (if expanded) */}
                    {isExpanded && displaySummary && (
                      <p className="text-xs text-slate-400 leading-relaxed mt-2 mb-3">
                        {displaySummary}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Đọc tin gốc
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      
                      {isEnglish && (
                        <a
                          href={translateButton(item.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          🌐 Xem bản dịch
                        </a>
                      )}

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="text-xs text-slate-500 hover:text-slate-300 ml-auto"
                      >
                        {isExpanded ? "Thu gọn ▲" : "Chi tiết ▼"}
                      </button>
                    </div>

                    {/* Domain */}
                    <div className="text-[10px] text-slate-600 mt-1">
                      {domain}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
        <span>
          Nguồn: CafeF • Vietstock • Bloomberg • Reuters • CoinDesk • TechCrunch
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Auto-refresh 2 phút
        </span>
      </div>
    </section>
  );
}
