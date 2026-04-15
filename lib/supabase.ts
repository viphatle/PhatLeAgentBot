import { createClient } from "@supabase/supabase-js";
import type { AppSettings, ScheduleEvent, WatchItem } from "./types";
import type { Forecast, HistoryPeriod } from "./history";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

export class SupabaseRequiredError extends Error {
  constructor() {
    super(
      "Thiếu cấu hình Supabase. Cần NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY.",
    );
    this.name = "SupabaseRequiredError";
  }
}

function getClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new SupabaseRequiredError();
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

export function storageReady() {
  return Boolean(supabaseUrl && supabaseKey);
}

// Watchlist
export async function getWatchlist(): Promise<WatchItem[]> {
  if (!storageReady()) return [];
  const supabase = getClient();
  const { data, error } = await supabase
    .from("watchlist")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getWatchlist error:", error);
    return [];
  }
  return data?.map((item: { 
    id: number; 
    symbol: string; 
    buy_price: number | null;
    display_name?: string;
    display_name_vi?: string;
    short_name?: string;
    exchange?: string;
    full_exchange?: string;
    yahoo_symbol?: string;
    created_at: string;
  }) => ({
    id: String(item.id),
    symbol: item.symbol,
    buy_price: item.buy_price ?? undefined,
    display_name: item.display_name || item.symbol,
    display_name_vi: item.display_name_vi,
    short_name: item.short_name,
    exchange: item.exchange,
    full_exchange: item.full_exchange,
    yahoo_symbol: item.yahoo_symbol,
    created_at: item.created_at || new Date().toISOString(),
  })) ?? [];
}

export async function setWatchlist(items: WatchItem[]) {
  if (!storageReady()) throw new SupabaseRequiredError();
  const supabase = getClient();
  
  // Xóa tất cả và insert mới
  await supabase.from("watchlist").delete().neq("id", 0);
  
  if (items.length > 0) {
    const { error } = await supabase.from("watchlist").insert(
      items.map((item) => ({
        symbol: item.symbol,
        buy_price: item.buy_price,
      }))
    );
    if (error) throw error;
  }
}

// Settings
export async function getSettings(): Promise<AppSettings> {
  if (!storageReady()) {
    return {
      telegram_bot_token: "",
      telegram_chat_id: "",
      mock_prices: false,
    };
  }
  const supabase = getClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error || !data) {
    return {
      telegram_bot_token: "",
      telegram_chat_id: "",
      mock_prices: false,
    };
  }
  return {
    telegram_bot_token: data.telegram_bot_token ?? "",
    telegram_chat_id: data.telegram_chat_id ?? "",
    mock_prices: data.mock_prices ?? false,
  };
}

export async function setSettings(partial: Partial<AppSettings>) {
  if (!storageReady()) throw new SupabaseRequiredError();
  const supabase = getClient();
  const current = await getSettings();
  const next = { ...current, ...partial };
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    telegram_bot_token: next.telegram_bot_token,
    telegram_chat_id: next.telegram_chat_id,
    mock_prices: next.mock_prices,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return next;
}

// Schedule Events
export async function getScheduleEvents(): Promise<ScheduleEvent[]> {
  if (!storageReady()) return [];
  const supabase = getClient();
  const { data, error } = await supabase
    .from("schedule_events")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getScheduleEvents error:", error);
    return [];
  }
  return data?.map((e: Record<string, unknown>) => ({
    id: String(e.id),
    date: String(e.date),
    time: e.time ? String(e.time) : "",
    note: e.note ? String(e.note) : "",
    recurrence: e.recurrence ? JSON.parse(String(e.recurrence)) : { mode: "none" as const },
    visibility: (e.visibility as "public" | "private") ?? "private",
    created_by: e.created_by ? String(e.created_by) : undefined,
    created_at: e.created_at ? String(e.created_at) : new Date().toISOString(),
    remind_1d_keys: e.remind_1d_keys ? JSON.parse(String(e.remind_1d_keys)) : [],
    remind_1h_keys: e.remind_1h_keys ? JSON.parse(String(e.remind_1h_keys)) : [],
  })) ?? [];
}

export async function setScheduleEvents(next: ScheduleEvent[]) {
  if (!storageReady()) throw new SupabaseRequiredError();
  const supabase = getClient();
  
  // Xóa tất cả và insert mới
  await supabase.from("schedule_events").delete().neq("id", "placeholder");
  
  if (next.length > 0) {
    const { error } = await supabase.from("schedule_events").insert(
      next.map((e) => ({
        id: e.id,
        date: e.date,
        time: e.time,
        note: e.note,
        recurrence: JSON.stringify(e.recurrence ?? { mode: "none" }),
        visibility: e.visibility ?? "private",
        created_by: e.created_by,
        created_at: e.created_at ?? new Date().toISOString(),
        remind_1d_keys: JSON.stringify(e.remind_1d_keys ?? []),
        remind_1h_keys: JSON.stringify(e.remind_1h_keys ?? []),
      }))
    );
    if (error) throw error;
  }
}

// PNL Alerts
export type PnlAlertState = {
  day: string;
  alert_level: number | null;
  last_alert_time?: number;
  daily_count?: number;
};

export async function getPnlAlertState(symbol: string): Promise<PnlAlertState | null> {
  if (!storageReady()) return null;
  const supabase = getClient();
  const { data, error } = await supabase
    .from("pnl_alerts")
    .select("*")
    .eq("symbol", symbol.toUpperCase().trim())
    .single();
  if (error || !data) return null;
  return {
    day: data.day,
    alert_level: data.alert_level,
    last_alert_time: data.last_alert_time,
    daily_count: data.daily_count,
  };
}

export async function setPnlAlertState(symbol: string, value: PnlAlertState) {
  if (!storageReady()) return;
  const supabase = getClient();
  await supabase.from("pnl_alerts").upsert({
    symbol: symbol.toUpperCase().trim(),
    day: value.day,
    alert_level: value.alert_level,
    last_alert_time: value.last_alert_time,
    daily_count: value.daily_count,
    updated_at: new Date().toISOString(),
  });
}

// Forecasts
export async function getForecast(symbol: string, period: HistoryPeriod): Promise<Forecast | null> {
  if (!storageReady()) return null;
  const supabase = getClient();
  const { data, error } = await supabase
    .from("forecasts")
    .select("data")
    .eq("symbol", symbol.toUpperCase().trim())
    .eq("period", period)
    .single();
  if (error || !data) return null;
  return data.data as Forecast;
}

export async function setForecast(symbol: string, period: HistoryPeriod, value: Forecast) {
  if (!storageReady()) return;
  const supabase = getClient();
  const forecastWithMeta = {
    ...value,
    _timestamp: Date.now(),
  };
  await supabase.from("forecasts").upsert({
    symbol: symbol.toUpperCase().trim(),
    period,
    data: forecastWithMeta,
    _timestamp: Date.now(),
    updated_at: new Date().toISOString(),
  });
}

// Generic JSON storage (for any other data)
export async function getJsonValue<T>(key: string): Promise<T | null> {
  // Không dùng cho Supabase - dùng các hàm cụ thể
  return null;
}

export async function setJsonValue(key: string, value: unknown) {
  // Không dùng cho Supabase - dùng các hàm cụ thể
}
