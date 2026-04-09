import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Real RSS feed URLs
const RSS_FEEDS = {
  finance: [
    { name: "CafeF", rss: "https://cafef.vn/rss/tai-chinh-ngan-hang.rss", lang: "vi" as const },
    { name: "CafeF CK", rss: "https://cafef.vn/rss/chung-khoan.rss", lang: "vi" as const },
    { name: "Vietstock", rss: "https://vietstock.vn/rss/chung-khoan.rss", lang: "vi" as const },
  ],
  economy: [
    { name: "VnExpress Kinh doanh", rss: "https://vnexpress.net/rss/kinh-doanh.rss", lang: "vi" as const },
    { name: "CafeF Doanh nghiệp", rss: "https://cafef.vn/rss/doanh-nghiep.rss", lang: "vi" as const },
  ],
  crypto: [
    // Using CoinDesk RSS via FeedBurner
    { name: "CoinDesk", rss: "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml", lang: "en" as const },
    { name: "CoinTelegraph", rss: "https://cointelegraph.com/rss", lang: "en" as const },
  ],
  tech: [
    { name: "TechCrunch", rss: "https://techcrunch.com/feed/", lang: "en" as const },
  ],
};

export type NewsCategory = "finance" | "crypto" | "tech" | "economy";

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  category: NewsCategory;
  publishedAt: string;
  summary?: string;
  lang: "vi" | "en";
};

// Parse RSS XML to extract items
function parseRSS(xml: string, sourceName: string, category: NewsCategory, lang: "vi" | "en"): NewsItem[] {
  const items: NewsItem[] = [];
  
  // Extract item blocks using regex
  const itemRegex = /<item[^>]*>[\s\S]*?<\/item>/gi;
  const itemsMatch = xml.match(itemRegex);
  
  if (!itemsMatch) return items;
  
  for (const itemXml of itemsMatch.slice(0, 5)) { // Get top 5 per source
    // Extract title
    const titleMatch = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const title = titleMatch ? decodeXml(titleMatch[1].trim()) : "";
    
    // Extract link
    const linkMatch = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    let url = linkMatch ? decodeXml(linkMatch[1].trim()) : "";
    
    // Some RSS use guid as link
    if (!url) {
      const guidMatch = itemXml.match(/<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/i);
      url = guidMatch ? decodeXml(guidMatch[1].trim()) : "";
    }
    
    // Extract pubDate
    const pubDateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();
    
    // Extract description/summary
    const descMatch = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    const summary = descMatch ? cleanHtml(decodeXml(descMatch[1].trim())).slice(0, 200) : undefined;
    
    if (title && url) {
      items.push({
        id: `${sourceName}-${Buffer.from(url).toString("base64").slice(0, 12)}`,
        title,
        url,
        source: sourceName,
        category,
        publishedAt: new Date(pubDate).toISOString(),
        summary,
        lang,
      });
    }
  }
  
  return items;
}

// Decode XML entities
function decodeXml(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Clean HTML tags
function cleanHtml(str: string): string {
  return str
    .replace(/<[^>]+>/g, " ") // Remove HTML tags
    .replace(/\s+/g, " ")     // Collapse whitespace
    .trim();
}

// Fetch RSS with timeout
async function fetchRSS(url: string, timeoutMs = 5000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
      signal: controller.signal,
      next: { revalidate: 0 },
    });
    
    clearTimeout(timeout);
    
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error(`RSS fetch failed for ${url}:`, err);
    return null;
  }
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return `${diffDays} ngày trước`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") as NewsCategory | null;

  try {
    // Fetch all RSS feeds in parallel
    const allNews: NewsItem[] = [];
    
    const feedsToFetch = category 
      ? { [category]: RSS_FEEDS[category] || [] }
      : RSS_FEEDS;
    
    const fetchPromises: Promise<void>[] = [];
    
    for (const [cat, feeds] of Object.entries(feedsToFetch)) {
      for (const feed of feeds) {
        const promise = (async () => {
          const xml = await fetchRSS(feed.rss, 6000);
          if (xml) {
            const items = parseRSS(xml, feed.name, cat as NewsCategory, feed.lang);
            allNews.push(...items);
          }
        })();
        fetchPromises.push(promise);
      }
    }
    
    // Wait for all with overall timeout
    await Promise.all(fetchPromises);
    
    // Deduplicate by URL (normalized) and title similarity
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    
    const uniqueNews = allNews
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .filter(item => {
        // Normalize URL for dedupe (remove trailing slash, query params)
        const normalizedUrl = item.url
          .replace(/\/$/, '')
          .replace(/\?.*$/, '')
          .toLowerCase();
        
        // Normalize title for dedupe (lowercase, remove extra spaces)
        const normalizedTitle = item.title
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 50); // Compare first 50 chars
        
        // Check URL duplicate
        if (seenUrls.has(normalizedUrl)) {
          console.log(`[News dedupe] URL duplicate: ${item.title.slice(0, 30)}...`);
          return false;
        }
        
        // Check title similarity (same article from different sources)
        const seenTitlesArray = Array.from(seenTitles);
        for (const seenTitle of seenTitlesArray) {
          if (normalizedTitle.includes(seenTitle) || seenTitle.includes(normalizedTitle)) {
            console.log(`[News dedupe] Title similar: ${item.title.slice(0, 30)}...`);
            return false;
          }
        }
        
        seenUrls.add(normalizedUrl);
        seenTitles.add(normalizedTitle);
        return true;
      })
      .slice(0, 10);

    // Add relative time
    const enriched = uniqueNews.map(item => ({
      ...item,
      relativeTime: formatRelativeTime(item.publishedAt),
    }));

    return NextResponse.json({
      news: enriched,
      lastUpdated: new Date().toISOString(),
      sourceCount: Object.values(RSS_FEEDS).flat().length,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (error) {
    console.error("News fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch news", news: [] },
      { status: 500 }
    );
  }
}
