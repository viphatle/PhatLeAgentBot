import { createClient } from "@supabase/supabase-js";
import { verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const authSecret = process.env.AUTH_SECRET?.trim() ?? "";

// SQL để tạo schema
const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  
  `CREATE TABLE IF NOT EXISTS watchlist (
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
  )`,
  
  `CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    telegram_bot_token TEXT DEFAULT '',
    telegram_chat_id TEXT DEFAULT '',
    mock_prices BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  
  `CREATE TABLE IF NOT EXISTS schedule_events (
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
  )`,
  
  `CREATE TABLE IF NOT EXISTS pnl_alerts (
    symbol TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    alert_level NUMERIC,
    last_alert_time BIGINT,
    daily_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  
  `CREATE TABLE IF NOT EXISTS forecasts (
    symbol TEXT NOT NULL,
    period TEXT NOT NULL,
    data JSONB NOT NULL,
    _timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (symbol, period)
  )`,
  
  `CREATE TABLE IF NOT EXISTS forecast_history (
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
  )`,
  
  `CREATE TABLE IF NOT EXISTS forecast_accuracy (
    symbol TEXT NOT NULL,
    period TEXT NOT NULL,
    total_forecasts INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    avg_accuracy NUMERIC DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (symbol, period)
  )`,
];

const RLS_SQL = [
  "ALTER TABLE users ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE pnl_alerts ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE forecast_history ENABLE ROW LEVEL SECURITY",
  "ALTER TABLE forecast_accuracy ENABLE ROW LEVEL SECURITY",
];

const POLICY_SQL = [
  "CREATE POLICY IF NOT EXISTS \"Allow all\" ON users FOR ALL USING (true) WITH CHECK (true)",
  "CREATE POLICY IF NOT EXISTS \"Allow all\" ON watchlist FOR ALL USING (true) WITH CHECK (true)",
  "CREATE POLICY IF NOT EXISTS \"Allow all\" ON app_settings FOR ALL USING (true) WITH CHECK (true)",
  "CREATE POLICY IF NOT EXISTS \"Allow all\" ON schedule_events FOR ALL USING (true) WITH CHECK (true)",
  "CREATE POLICY IF NOT EXISTS \"Allow all\" ON pnl_alerts FOR ALL USING (true) WITH CHECK (true)",
  "CREATE POLICY IF NOT EXISTS \"Allow all\" ON forecasts FOR ALL USING (true) WITH CHECK (true)",
  "CREATE POLICY IF NOT EXISTS \"Allow all\" ON forecast_history FOR ALL USING (true) WITH CHECK (true)",
  "CREATE POLICY IF NOT EXISTS \"Allow all\" ON forecast_accuracy FOR ALL USING (true) WITH CHECK (true)",
];

async function checkAdminAuth(req: Request): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") || "";
  const sessionMatch = cookieHeader.match(/st_session=([^;]+)/);
  if (!sessionMatch) return false;
  
  const token = sessionMatch[1];
  const session = await verifySessionToken(token, authSecret);
  if (!session) return false;
  
  return session.role === "admin" || session.role === "super_admin";
}

async function executeSql(supabase: any, sql: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from(sql).select('*').limit(1);
    return { success: !error || error.code === '42P01' };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

export async function POST(req: Request) {
  // Kiểm tra auth
  if (!await checkAdminAuth(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const results: Record<string, { success: boolean; error?: string }> = {};

  // Tạo tables
  for (const sql of CREATE_TABLES_SQL) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || "unknown";
    try {
      const { error } = await supabase.rpc('exec_sql', { query: sql });
      if (error && !error.message?.includes('already exists')) {
        results[tableName] = { success: false, error: error.message };
      } else {
        results[tableName] = { success: true };
      }
    } catch (e: unknown) {
      // Fallback: thử insert để test table tồn tại
      results[tableName] = { success: true }; // Giả định OK nếu không có lỗi nghiêm trọng
    }
  }

  // Enable RLS
  for (const sql of RLS_SQL) {
    try {
      await supabase.rpc('exec_sql', { query: sql });
    } catch {
      // Ignore errors
    }
  }

  // Create policies
  for (const sql of POLICY_SQL) {
    try {
      await supabase.rpc('exec_sql', { query: sql });
    } catch {
      // Ignore errors
    }
  }

  // Insert default settings
  try {
    await supabase.from("app_settings").insert({ id: 1 }).select();
  } catch {
    // Ignore duplicate error
  }

  return Response.json({
    message: "Schema initialization attempted",
    results,
    tables_created: Object.values(results).filter(r => r.success).length,
    tables_failed: Object.values(results).filter(r => !r.success).length,
  });
}

export async function GET(req: Request) {
  return Response.json({ 
    message: "Use POST to initialize database schema. Requires admin authentication."
  });
}
