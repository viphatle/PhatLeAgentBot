-- Schema cho Stock Monitor trên Supabase
-- Chạy trong Supabase SQL Editor

-- Bảng users (thay thế st:users trong Redis)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng watchlist (thay thế st:watchlist trong Redis)
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

-- Bảng settings (thay thế st:settings trong Redis)
CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    telegram_bot_token TEXT DEFAULT '',
    telegram_chat_id TEXT DEFAULT '',
    mock_prices BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng schedule_events (thay thế st:schedule-events trong Redis)
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

-- Bảng pnl_alerts (thay thế st:pnl-alert:* trong Redis)
CREATE TABLE IF NOT EXISTS pnl_alerts (
    symbol TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    alert_level NUMERIC,
    last_alert_time BIGINT,
    daily_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng forecasts (thay thế st:forecast:* trong Redis)
CREATE TABLE IF NOT EXISTS forecasts (
    symbol TEXT NOT NULL,
    period TEXT NOT NULL,
    data JSONB NOT NULL,
    _timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (symbol, period)
);

-- Bảng files (nếu cần lưu metadata file)
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    size INTEGER,
    mime_type TEXT,
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng lịch sử dự báo (để tracking độ chính xác)
CREATE TABLE IF NOT EXISTS forecast_history (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    period TEXT NOT NULL,
    forecast_date TIMESTAMPTZ DEFAULT NOW(),
    -- Giá thực tế tại thời điểm dự báo
    actual_price NUMERIC NOT NULL,
    -- Kịch bản được dự đoán là chủ đạo
    predicted_scenario TEXT NOT NULL, -- 'bull', 'base', 'bear'
    -- Xác suất của kịch bản được chọn
    predicted_probability INTEGER NOT NULL,
    -- Chi tiết các kịch bản
    bull_price NUMERIC NOT NULL,
    bull_probability INTEGER NOT NULL,
    base_price NUMERIC NOT NULL,
    base_probability INTEGER NOT NULL,
    bear_price NUMERIC NOT NULL,
    bear_probability INTEGER NOT NULL,
    -- Kết quả (cập nhật sau khi hết kỳ)
    actual_result_scenario TEXT, -- 'bull', 'base', 'bear' (so sánh với dự báo)
    actual_price_end NUMERIC, -- Giá thực tế cuối kỳ
    accuracy NUMERIC, -- % chênh lệch giữa dự báo và thực tế
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, period, forecast_date)
);

-- Index cho truy vấn nhanh
CREATE INDEX IF NOT EXISTS idx_forecast_history_symbol ON forecast_history(symbol);
CREATE INDEX IF NOT EXISTS idx_forecast_history_period ON forecast_history(period);
CREATE INDEX IF NOT EXISTS idx_forecast_history_date ON forecast_history(forecast_date);

-- Bảng thống kê độ chính xác theo mã và kỳ
CREATE TABLE IF NOT EXISTS forecast_accuracy (
    symbol TEXT NOT NULL,
    period TEXT NOT NULL,
    total_forecasts INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    avg_accuracy NUMERIC DEFAULT 0, -- Trung bình % sai lệch
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (symbol, period)
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pnl_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_accuracy ENABLE ROW LEVEL SECURITY;

-- Tạo policies (cho phép đọc/ghi từ service role)
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON watchlist FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON schedule_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON pnl_alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON forecasts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON forecast_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON forecast_accuracy FOR ALL USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
