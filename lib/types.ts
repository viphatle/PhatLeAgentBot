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

export type UserRole = "admin" | "manager" | "viewer";

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  is_active: boolean;
};

export type AppSettings = {
  telegram_bot_token: string;
  telegram_chat_id: string;
  mock_prices: boolean;
  users?: User[]; // User management
  current_user_id?: string; // Currently logged in user
};

/** mock_demo = bật trong cài đặt */
export type QuoteSource = "yahoo" | "vndirect" | "tcbs" | "fireant" | "ssi" | "mock_demo";

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
  recurrence?: {
    mode: "none" | "weekly" | "monthly";
    weekdays?: number[]; // JS weekday: 0=CN ... 6=T7
    month_day?: number; // 1..31
  };
  created_at: string;
  remind_1d_keys?: string[]; // keys dạng YYYY-MM-DD
  remind_1h_keys?: string[]; // keys dạng YYYY-MM-DD
};

export type ScheduleOccurrence = {
  id: string; // eventId hoặc eventId@YYYY-MM-DD
  series_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  note: string;
  recurrence_mode: "none" | "weekly" | "monthly";
  recurrence_text: string;
};
