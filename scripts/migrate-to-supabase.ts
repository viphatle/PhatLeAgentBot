#!/usr/bin/env ts-node
/**
 * Script migration từ Redis sang Supabase
 * 
 * Chạy: npx ts-node scripts/migrate-to-supabase.ts
 * 
 * Yêu cầu:
 * - REDIS_URL (env hiện tại)
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "redis";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const redisUrl = process.env.REDIS_URL?.trim() ?? "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

const KEYS = {
  USERS: "st:users",
  WATCHLIST: "st:watchlist",
  SETTINGS: "st:settings",
  SCHEDULE_EVENTS: "st:schedule-events",
};

async function getRedisData<T>(key: string): Promise<T | null> {
  if (!redisUrl) return null;
  const client = createClient({ url: redisUrl });
  await client.connect();
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } finally {
    await client.disconnect();
  }
}

async function migrate() {
  console.log("🚀 Bắt đầu migration từ Redis sang Supabase...\n");

  if (!redisUrl) {
    console.error("❌ Thiếu REDIS_URL");
    process.exit(1);
  }
  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // 1. Migrate Users
  console.log("👤 Đang chuyển users...");
  const users = await getRedisData<Array<{ id: string; password_hash: string; role: string; created_at: string }>>(KEYS.USERS);
  if (users && users.length > 0) {
    const { error } = await supabase.from("users").insert(
      users.map((u) => ({
        id: u.id,
        password_hash: u.password_hash,
        role: u.role,
        created_at: u.created_at,
      }))
    );
    if (error) {
      console.error("  ❌ Lỗi users:", error.message);
    } else {
      console.log(`  ✅ Đã chuyển ${users.length} users`);
    }
  } else {
    console.log("  ℹ️ Không có users");
  }

  // 2. Migrate Watchlist
  console.log("\n📈 Đang chuyển watchlist...");
  const watchlist = await getRedisData<Array<{ id: string; symbol: string; buy_price?: number }>>(KEYS.WATCHLIST);
  if (watchlist && watchlist.length > 0) {
    const { error } = await supabase.from("watchlist").insert(
      watchlist.map((w) => ({
        symbol: w.symbol,
        buy_price: w.buy_price ?? null,
      }))
    );
    if (error) {
      console.error("  ❌ Lỗi watchlist:", error.message);
    } else {
      console.log(`  ✅ Đã chuyển ${watchlist.length} mã`);
    }
  } else {
    console.log("  ℹ️ Không có watchlist");
  }

  // 3. Migrate Settings
  console.log("\n⚙️ Đang chuyển settings...");
  const settings = await getRedisData<{
    telegram_bot_token?: string;
    telegram_chat_id?: string;
    mock_prices?: boolean;
  }>(KEYS.SETTINGS);
  if (settings) {
    const { error } = await supabase.from("app_settings").upsert({
      id: 1,
      telegram_bot_token: settings.telegram_bot_token ?? "",
      telegram_chat_id: settings.telegram_chat_id ?? "",
      mock_prices: settings.mock_prices ?? false,
    });
    if (error) {
      console.error("  ❌ Lỗi settings:", error.message);
    } else {
      console.log("  ✅ Đã chuyển settings");
    }
  } else {
    console.log("  ℹ️ Không có settings");
  }

  // 4. Migrate Schedule Events
  console.log("\n📅 Đang chuyển schedule events...");
  const events = await getRedisData<Array<{
    id: string;
    title: string;
    date: string;
    time?: string;
    note?: string;
    recurrence?: string;
    visibility?: "public" | "private";
    created_by?: string;
  }>>(KEYS.SCHEDULE_EVENTS);
  if (events && events.length > 0) {
    const { error } = await supabase.from("schedule_events").insert(
      events.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        time: e.time ?? null,
        note: e.note ?? null,
        recurrence: e.recurrence ?? "none",
        visibility: e.visibility ?? "private",
        created_by: e.created_by ?? null,
      }))
    );
    if (error) {
      console.error("  ❌ Lỗi schedule events:", error.message);
    } else {
      console.log(`  ✅ Đã chuyển ${events.length} sự kiện`);
    }
  } else {
    console.log("  ℹ️ Không có schedule events");
  }

  console.log("\n✨ Migration hoàn tất!");
  console.log("\n⚠️  Lưu ý: Sau khi migration, hãy:");
  console.log("   1. Cập nhật lib/kv.ts và lib/auth.ts để sử dụng supabase.ts");
  console.log("   2. Kiểm tra lại toàn bộ chức năng");
  console.log("   3. Xóa REDIS_URL sau khi chắc chắn mọi thứ hoạt động");
}

migrate().catch(console.error);
