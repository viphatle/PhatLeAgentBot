import { createClient } from "redis";
import type { AppSettings, ScheduleEvent, WatchItem } from "./types";

const WATCHLIST_KEY = "st:watchlist";
const SETTINGS_KEY = "st:settings";
const SCHEDULE_EVENTS_KEY = "st:schedule-events";
const PNL_ALERT_PREFIX = "st:pnl-alert:";

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
};

function resolveRedisEnv(): RedisEnv {
  const redisUrl = process.env.REDIS_URL;
  const redisToken = process.env.REDIS_TOKEN;

  if (!redisUrl) return {};

  try {
    const parsed = new URL(redisUrl);
    if (redisToken && !parsed.password) {
      parsed.password = redisToken;
      if (!parsed.username) parsed.username = "default";
    }
    return { url: parsed.toString() };
  } catch {
    return {};
  }
}

function hasRedisConfig() {
  const cfg = resolveRedisEnv();
  return Boolean(cfg.url);
}

export function storageReady() {
  return hasRedisConfig();
}

let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnectPromise: Promise<unknown> | null = null;

async function getRedisClient() {
  const cfg = resolveRedisEnv();
  if (!cfg.url) throw new KvRequiredError();
  if (!redisClient) {
    redisClient = createClient({ url: cfg.url });
    redisConnectPromise = redisClient.connect();
  }
  if (redisConnectPromise) {
    await redisConnectPromise;
    redisConnectPromise = null;
  }
  return redisClient;
}

async function kvGet<T>(key: string): Promise<T | null> {
  const redis = await getRedisClient();
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: unknown) {
  const redis = await getRedisClient();
  await redis.set(key, JSON.stringify(value));
}

export async function getJsonValue<T>(key: string): Promise<T | null> {
  if (!hasRedisConfig()) return null;
  return kvGet<T>(key);
}

export async function setJsonValue(key: string, value: unknown) {
  if (!hasRedisConfig()) throw new KvRequiredError();
  await kvSet(key, value);
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

export async function getScheduleEvents(): Promise<ScheduleEvent[]> {
  if (!hasRedisConfig()) return [];
  const v = await kvGet<ScheduleEvent[]>(SCHEDULE_EVENTS_KEY);
  return Array.isArray(v) ? v : [];
}

export async function setScheduleEvents(next: ScheduleEvent[]) {
  if (!hasRedisConfig()) throw new KvRequiredError();
  await kvSet(SCHEDULE_EVENTS_KEY, next);
}

export type PnlAlertState = {
  day: string;
  alert_level: number | null;  // e.g., 0, -10, -20, etc.
};

export async function getPnlAlertState(symbol: string): Promise<PnlAlertState | null> {
  if (!hasRedisConfig()) return null;
  return kvGet<PnlAlertState>(`${PNL_ALERT_PREFIX}${symbol.toUpperCase().trim()}`);
}

export async function setPnlAlertState(symbol: string, value: PnlAlertState) {
  if (!hasRedisConfig()) return;
  await kvSet(`${PNL_ALERT_PREFIX}${symbol.toUpperCase().trim()}`, value);
}
