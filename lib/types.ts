export type WatchItem = {
  id: string;
  symbol: string;
  /** Tên công ty (tự lấy từ Yahoo longName / shortName) */
  display_name: string;
  short_name?: string;
  exchange?: string;
  full_exchange?: string;
  yahoo_symbol?: string;
  created_at: string;
};

export type AppSettings = {
  telegram_bot_token: string;
  telegram_chat_id: string;
  mock_prices: boolean;
};

/** mock_demo = bật trong cài đặt; mock_fallback = API thật lỗi/không có dữ liệu */
export type QuoteSource = "yahoo" | "vndirect" | "tcbs" | "mock_demo" | "mock_fallback";

export type Quote = {
  symbol: string;
  price: number;
  reference: number;
  change: number;
  change_pct: number;
  volume: number;
  source: QuoteSource;
};
