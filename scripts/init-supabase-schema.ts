#!/usr/bin/env ts-node
/**
 * Script khởi tạo schema Supabase
 * Chạy: npx ts-node scripts/init-supabase-schema.ts
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const SCHEMA_SQL = `
-- Bảng users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng watchlist
CREATE TABLE IF NOT EXISTS watchlist (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    buy_price NUMERIC,
    display_name TEXT,
    display_name_vi TEXT,
    short_name TEXT,
    exchange TEXT,
    full_exchange TEXT,
    yahoo_symbol TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol)
);

-- Bảng app_settings
CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    telegram_bot_token TEXT DEFAULT '',
    telegram_chat_id TEXT DEFAULT '',
    mock_prices BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng schedule_events
CREATE TABLE IF NOT EXISTS schedule_events (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    time TEXT,
    note TEXT,
    recurrence JSONB DEFAULT '{"mode":"none"}',
    visibility TEXT DEFAULT 'private',
    created_by TEXT,
    remind_1d_keys JSONB DEFAULT '[]',
    remind_1h_keys JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng pnl_alerts
CREATE TABLE IF NOT EXISTS pnl_alerts (
    symbol TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    alert_level NUMERIC,
    last_alert_time BIGINT,
    daily_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng forecasts
CREATE TABLE IF NOT EXISTS forecasts (
    symbol TEXT NOT NULL,
    period TEXT NOT NULL,
    data JSONB NOT NULL,
    _timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (symbol, period)
);

-- Bảng forecast_history
CREATE TABLE IF NOT EXISTS forecast_history (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    period TEXT NOT NULL,
    forecast_date TIMESTAMPTZ DEFAULT NOW(),
    actual_price NUMERIC NOT NULL,
    predicted_scenario TEXT NOT NULL,
    predicted_probability INTEGER NOT NULL,
    bull_price NUMERIC NOT NULL,
    bull_probability INTEGER NOT NULL,
    base_price NUMERIC NOT NULL,
    base_probability INTEGER NOT NULL,
    bear_price NUMERIC NOT NULL,
    bear_probability INTEGER NOT NULL,
    actual_result_scenario TEXT,
    actual_price_end NUMERIC,
    accuracy NUMERIC,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, period, forecast_date)
);

-- Bảng forecast_accuracy
CREATE TABLE IF NOT EXISTS forecast_accuracy (
    symbol TEXT NOT NULL,
    period TEXT NOT NULL,
    total_forecasts INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    avg_accuracy NUMERIC DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (symbol, period)
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pnl_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_accuracy ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY IF NOT EXISTS "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all" ON watchlist FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all" ON app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all" ON schedule_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all" ON pnl_alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all" ON forecasts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all" ON forecast_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all" ON forecast_accuracy FOR ALL USING (true) WITH CHECK (true);

-- Default settings
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
`;

async function initSchema() {
  console.log("🚀 Khởi tạo schema Supabase...\n");
  
  try {
    // Thử chạy từng câu lệnh riêng biệt
    const statements = SCHEMA_SQL.split(';').filter(s => s.trim().length > 0);
    
    for (const stmt of statements) {
      const sql = stmt.trim() + ';';
      try {
        const { error } = await supabase.rpc('exec_sql', { sql });
        if (error && !error.message?.includes('already exists')) {
          console.log(`⚠️ ${error.message}`);
        }
      } catch {
        // RPC không tồn tại, bỏ qua
      }
    }
    
    // Kiểm tra các bảng đã tạo
    const tables = ['users', 'watchlist', 'app_settings', 'schedule_events', 'pnl_alerts', 'forecasts', 'forecast_history', 'forecast_accuracy'];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: OK`);
      }
    }
    
    console.log("\n🎉 Hoàn tất!");
    
  } catch (err) {
    console.error("\n❌ Lỗi:", err);
    process.exit(1);
  }
}

initSchema();
