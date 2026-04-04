import type { AppSettings, WatchItem } from "./types";

const WATCHLIST_KEY = "st:watchlist";
const SETTINGS_KEY = "st:settings";

const defaultSettings = (): AppSettings => ({
  telegram_bot_token: "",
  telegram_chat_id: "",
  mock_prices: false,
});

export class KvRequiredError extends Error {
  constructor() {
    super(
      "Thiếu cấu hình Redis. Cần REDIS_URL (và REDIS_TOKEN nếu URL không chứa sẵn token).",
    );
    this.name = "KvRequiredError";
  }
}

type RedisEnv = {
  url?: string;
  token?: string;
};

function resolveRedisEnv(): RedisEnv {
  const redisUrl = process.env.REDIS_URL;
  const redisToken = process.env.REDIS_TOKEN;

  if (!redisUrl) return {};

  try {
    const parsed = new URL(redisUrl);
    const tokenFromUrl =
      parsed.searchParams.get("token") || parsed.searchParams.get("auth_token") || undefined;
    const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;

    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return {
        url: `${parsed.protocol}//${parsed.host}${parsed.pathname}`,
        token: redisToken || tokenFromUrl || password,
      };
    }

    if (parsed.protocol === "redis:" || parsed.protocol === "rediss:") {
      return {
        url: `https://${parsed.hostname}`,
        token: redisToken || password,
      };
    }
  } catch {
    return {};
  }

  return {};
}

function hasRedisConfig() {
  const cfg = resolveRedisEnv();
  return Boolean(cfg.url && cfg.token);
}

export function storageReady() {
  return hasRedisConfig();
}

function normalizeKvEnv() {
  const cfg = resolveRedisEnv();
  if (!cfg.url || !cfg.token) return;
  if (!process.env.KV_REST_API_URL) process.env.KV_REST_API_URL = cfg.url;
  if (!process.env.KV_REST_API_TOKEN) process.env.KV_REST_API_TOKEN = cfg.token;
}

async function kvGet<T>(key: string): Promise<T | null> {
  normalizeKvEnv();
  const { kv } = await import("@vercel/kv");
  return (await kv.get<T>(key)) ?? null;
}

async function kvSet(key: string, value: unknown) {
  normalizeKvEnv();
  const { kv } = await import("@vercel/kv");
  await kv.set(key, value);
}

export async function getWatchlist(): Promise<WatchItem[]> {
  if (!hasRedisConfig()) return [];
  const v = await kvGet<WatchItem[]>(WATCHLIST_KEY);
  return Array.isArray(v) ? v : [];
}

export async function setWatchlist(items: WatchItem[]) {
  if (!hasRedisConfig()) throw new KvRequiredError();
  await kvSet(WATCHLIST_KEY, items);
}

export async function getSettings(): Promise<AppSettings> {
  if (!hasRedisConfig()) return defaultSettings();
  const v = await kvGet<AppSettings>(SETTINGS_KEY);
  return { ...defaultSettings(), ...(v ?? {}) };
}

export async function setSettings(partial: Partial<AppSettings>) {
  if (!hasRedisConfig()) throw new KvRequiredError();
  const cur = await getSettings();
  const next = { ...cur, ...partial };
  await kvSet(SETTINGS_KEY, next);
  return next;
}
