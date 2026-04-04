export type WatchItem = {
  id: string;
  symbol: string;
  /** Giá đã mua (tuỳ chọn), đơn vị VND/cp */
  buy_price?: number;
  /** Tên công ty (tự lấy từ Yahoo longName / shortName) */
  display_name: string;
  /** Tên tiếng Việt (nếu có trong mapping) */
  display_name_vi?: string;
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

/** mock_demo = bật trong cài đặt */
export type QuoteSource = "yahoo" | "vndirect" | "tcbs" | "mock_demo";

export type Quote = {
  symbol: string;
  price: number;
  reference: number;
  change: number;
  change_pct: number;
  volume: number;
  source: QuoteSource;
};

export type ScheduleNoteMap = Record<string, string>;

export type ScheduleEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  note: string;
  created_at: string;
  remind_1d_sent_at?: string;
  remind_1h_sent_at?: string;
};
