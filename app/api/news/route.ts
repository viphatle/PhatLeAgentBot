import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const revalidate = 0;

// News sources configuration
const NEWS_SOURCES = {
  finance: [
    { name: "CafeF", url: "https://cafef.vn", rss: "https://cafef.vn/rss/tai-chinh-ngan-hang.rss" },
    { name: "Vietstock", url: "https://vietstock.vn", rss: "https://vietstock.vn/rss/chung-khoan.rss" },
    { name: "Bloomberg", url: "https://www.bloomberg.com", lang: "en" },
    { name: "Reuters", url: "https://www.reuters.com", lang: "en" },
  ],
  crypto: [
    { name: "CoinDesk", url: "https://www.coindesk.com", lang: "en" },
    { name: "CoinTelegraph", url: "https://cointelegraph.com", lang: "en" },
  ],
  tech: [
    { name: "TechCrunch", url: "https://techcrunch.com", lang: "en" },
    { name: "The Verge", url: "https://www.theverge.com", lang: "en" },
  ],
  economy: [
    { name: "VnExpress Kinh tế", url: "https://vnexpress.net/kinh-doanh", lang: "vi" },
    { name: "Reuters Economy", url: "https://www.reuters.com/world/", lang: "en" },
  ],
};

// Types
export type NewsCategory = "finance" | "crypto" | "tech" | "economy";

export type NewsItem = {
  id: string;
  title: string;
  titleVi?: string; // Translated title
  summary?: string;
  summaryVi?: string; // Translated summary
  url: string;
  source: string;
  category: NewsCategory;
  publishedAt: string;
  imageUrl?: string;
  lang: "vi" | "en";
};

// Mock news data generator (replace with real RSS/API fetching)
function generateMockNews(): NewsItem[] {
  const now = new Date();
  const news: NewsItem[] = [
    // Finance - Vietnam
    {
      id: "vn-1",
      title: "Chứng khoán Việt Nam tăng điểm mạnh nhất khu vực ASEAN",
      url: "https://cafef.vn/chung-khoan-vn-tang-diem.html",
      source: "CafeF",
      category: "finance",
      publishedAt: new Date(now.getTime() - 5 * 60000).toISOString(),
      lang: "vi",
    },
    {
      id: "vn-2",
      title: "Ngân hàng Nhà nước giữ nguyên lãi suất điều hành",
      url: "https://vietstock.vn/lai-suat-dieu-hanh.html",
      source: "Vietstock",
      category: "finance",
      publishedAt: new Date(now.getTime() - 15 * 60000).toISOString(),
      lang: "vi",
    },
    {
      id: "vn-3",
      title: "Vingroup công bố kết quả kinh doanh quý 4/2025",
      url: "https://vnexpress.net/vingroup-kqkd.html",
      source: "VnExpress",
      category: "economy",
      publishedAt: new Date(now.getTime() - 30 * 60000).toISOString(),
      lang: "vi",
    },
    // Finance - International
    {
      id: "int-1",
      title: "Fed signals rate cuts may begin in Q3 2026",
      titleVi: "Fed báo hiệu có thể cắt giảm lãi suất từ quý 3/2026",
      summary: "Federal Reserve officials hinted at potential rate reductions as inflation shows signs of cooling.",
      summaryVi: "Các quan chức Fed ám chỉ khả năng giảm lãi suất khi lạm phát có dấu hiệu hạ nhiệt.",
      url: "https://www.bloomberg.com/news/fed-rates",
      source: "Bloomberg",
      category: "finance",
      publishedAt: new Date(now.getTime() - 10 * 60000).toISOString(),
      lang: "en",
    },
    {
      id: "int-2",
      title: "Asian markets rally on tech sector optimism",
      titleVi: "Thị trường châu Á tăng điểm nhờ kỳ vọng ngành công nghệ",
      summary: "Technology stocks lead gains across major Asian indexes.",
      summaryVi: "Cổ phiếu công nghệ dẫn dắt đà tăng trên các chỉ số châu Á chính.",
      url: "https://www.reuters.com/markets/asia",
      source: "Reuters",
      category: "finance",
      publishedAt: new Date(now.getTime() - 25 * 60000).toISOString(),
      lang: "en",
    },
    // Crypto
    {
      id: "crypto-1",
      title: "Bitcoin surges past $95,000 amid institutional buying",
      titleVi: "Bitcoin vượt 95.000 USD nhờ mua vào từ tổ chức",
      summary: "Major financial institutions increase crypto allocations.",
      summaryVi: "Các tổ chức tài chính lớn tăng tỷ trọng đầu tư crypto.",
      url: "https://www.coindesk.com/markets/bitcoin",
      source: "CoinDesk",
      category: "crypto",
      publishedAt: new Date(now.getTime() - 8 * 60000).toISOString(),
      lang: "en",
    },
    {
      id: "crypto-2",
      title: "Ethereum 2.0 staking rewards hit record highs",
      titleVi: "Phần thưởng staking Ethereum 2.0 đạt mức cao kỷ lục",
      summary: "Validator rewards increase as network activity grows.",
      summaryVi: "Phần thưởng validator tăng khi hoạt động mạng phát triển.",
      url: "https://cointelegraph.com/ethereum",
      source: "CoinTelegraph",
      category: "crypto",
      publishedAt: new Date(now.getTime() - 45 * 60000).toISOString(),
      lang: "en",
    },
    {
      id: "crypto-3",
      title: "SEC approves new spot Ethereum ETFs",
      titleVi: "SEC phê duyệt ETF Ethereum giao ngay mới",
      summary: "Regulatory approval opens doors for institutional investors.",
      summaryVi: "Phê duyệt quy định mở cửa cho nhà đầu tư tổ chức.",
      url: "https://www.coindesk.com/policy/sec-eth-etf",
      source: "CoinDesk",
      category: "crypto",
      publishedAt: new Date(now.getTime() - 60 * 60000).toISOString(),
      lang: "en",
    },
    // Tech
    {
      id: "tech-1",
      title: "Apple unveils AI-powered features for iPhone 17",
      titleVi: "Apple ra mắt tính năng AI cho iPhone 17",
      summary: "New on-device AI capabilities enhance user experience.",
      summaryVi: "Khả năng AI trên thiết bị mới nâng cao trải nghiệm người dùng.",
      url: "https://techcrunch.com/apple-ai-iphone",
      source: "TechCrunch",
      category: "tech",
      publishedAt: new Date(now.getTime() - 20 * 60000).toISOString(),
      lang: "en",
    },
    {
      id: "tech-2",
      title: "NVIDIA announces next-gen AI chips for data centers",
      titleVi: "NVIDIA công bố chip AI thế hệ mới cho trung tâm dữ liệu",
      summary: "New architecture promises 3x performance improvement.",
      summaryVi: "Kiến trúc mới hứa hẹn cải thiện hiệu suất gấp 3 lần.",
      url: "https://www.theverge.com/nvidia-ai-chips",
      source: "The Verge",
      category: "tech",
      publishedAt: new Date(now.getTime() - 40 * 60000).toISOString(),
      lang: "en",
    },
    {
      id: "tech-3",
      title: "OpenAI releases GPT-5 with multimodal capabilities",
      titleVi: "OpenAI ra mắt GPT-5 với khả năng đa phương thức",
      summary: "Latest model integrates text, image, and video understanding.",
      summaryVi: "Mô hình mới tích hợp hiểu văn bản, hình ảnh và video.",
      url: "https://techcrunch.com/openai-gpt5",
      source: "TechCrunch",
      category: "tech",
      publishedAt: new Date(now.getTime() - 120 * 60000).toISOString(),
      lang: "en",
    },
    // Economy
    {
      id: "econ-1",
      title: "Global trade volumes rebound in Q1 2026",
      titleVi: "Khối lượng thương mại toàn cầu phục hồi trong Q1/2026",
      summary: "Supply chain normalization drives international commerce.",
      summaryVi: "Chuỗi cung ứng bình thường hóa thúc đẩy thương mại quốc tế.",
      url: "https://www.reuters.com/world/trade",
      source: "Reuters",
      category: "economy",
      publishedAt: new Date(now.getTime() - 55 * 60000).toISOString(),
      lang: "en",
    },
  ];

  // Sort by published time (newest first) and take top 10
  return news
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 10);
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
    // In production, fetch from real RSS/API sources
    // For now, use mock data with realistic structure
    const news = generateMockNews();
    
    // Filter by category if specified
    const filtered = category 
      ? news.filter(n => n.category === category)
      : news;

    // Add relative time formatting
    const enriched = filtered.map(item => ({
      ...item,
      relativeTime: formatRelativeTime(item.publishedAt),
    }));

    return NextResponse.json({
      news: enriched,
      lastUpdated: new Date().toISOString(),
      sources: Object.keys(NEWS_SOURCES),
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (error) {
    console.error("News fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}
