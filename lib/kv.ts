import { promises as fs } from "fs";
import path from "path";
import type { AppSettings, WatchItem } from "./types";

const WATCHLIST_KEY = "st:watchlist";
const SETTINGS_KEY = "st:settings";

type FileStoreShape = {
  watchlist: WatchItem[];
  settings: AppSettings;
};

const defaultSettings = (): AppSettings => ({
  telegram_bot_token: "",
  telegram_chat_id: "",
  mock_prices: false,
});

function useKv() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function isVercel() {
  return process.env.VERCEL === "1";
}

/** Trên Vercel bắt buộc có KV; local có thể dùng file .local-kv */
export function storageReady() {
  return useKv() || !isVercel();
}

export class KvRequiredError extends Error {
  constructor() {
    super("Cần tạo và liên kết Vercel KV với project (KV_REST_API_URL / KV_REST_API_TOKEN).");
    this.name = "KvRequiredError";
  }
}

async function kvGet<T>(key: string): Promise<T | null> {
  const { kv } = await import("@vercel/kv");
  return (await kv.get<T>(key)) ?? null;
}

async function kvSet(key: string, value: unknown) {
  const { kv } = await import("@vercel/kv");
  await kv.set(key, value);
}

async function filePath() {
  const root = process.cwd();
  const dir = path.join(root, ".local-kv");
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, "data.json");
}

async function readFileStore(): Promise<FileStoreShape> {
  try {
    const p = await filePath();
    const raw = await fs.readFile(p, "utf8");
    const j = JSON.parse(raw) as FileStoreShape;
    return {
      watchlist: Array.isArray(j.watchlist) ? j.watchlist : [],
      settings: { ...defaultSettings(), ...j.settings },
    };
  } catch {
    return { watchlist: [], settings: defaultSettings() };
  }
}

async function writeFileStore(data: FileStoreShape) {
  const p = await filePath();
  await fs.writeFile(p, JSON.stringify(data, null, 2), "utf8");
}

export async function getWatchlist(): Promise<WatchItem[]> {
  if (useKv()) {
    const v = await kvGet<WatchItem[]>(WATCHLIST_KEY);
    return Array.isArray(v) ? v : [];
  }
  const f = await readFileStore();
  return f.watchlist;
}

export async function setWatchlist(items: WatchItem[]) {
  if (isVercel() && !useKv()) throw new KvRequiredError();
  if (useKv()) {
    await kvSet(WATCHLIST_KEY, items);
    return;
  }
  const f = await readFileStore();
  f.watchlist = items;
  await writeFileStore(f);
}

export async function getSettings(): Promise<AppSettings> {
  if (useKv()) {
    const v = await kvGet<AppSettings>(SETTINGS_KEY);
    return { ...defaultSettings(), ...(v ?? {}) };
  }
  const f = await readFileStore();
  return { ...defaultSettings(), ...f.settings };
}

export async function setSettings(partial: Partial<AppSettings>) {
  if (isVercel() && !useKv()) throw new KvRequiredError();
  const cur = await getSettings();
  const next = { ...cur, ...partial };
  if (useKv()) {
    await kvSet(SETTINGS_KEY, next);
    return next;
  }
  const f = await readFileStore();
  f.settings = next;
  await writeFileStore(f);
  return next;
}
