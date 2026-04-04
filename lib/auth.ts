import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getJsonValue, setJsonValue, storageReady } from "./kv";
import { createSessionToken, type SessionPayload, type SessionRole, verifySessionToken } from "./session";

const USERS_KEY = "st:users";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type AuthUser = {
  id: string;
  password_hash: string;
  role: SessionRole;
  created_at: string;
};

function normalizeUserId(id: string) {
  return id.trim().toLowerCase();
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(next, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function authSecret() {
  return process.env.AUTH_SECRET?.trim() ?? "";
}

export function authConfigured() {
  return Boolean(authSecret() && storageReady());
}

export async function getUsers() {
  const users = await getJsonValue<AuthUser[]>(USERS_KEY);
  return Array.isArray(users) ? users : [];
}

async function saveUsers(users: AuthUser[]) {
  await setJsonValue(USERS_KEY, users);
}

export async function ensureBootstrapAdmin() {
  const existing = await getUsers();
  if (existing.length > 0) return existing;

  const bootstrapId = normalizeUserId(
    process.env.AUTH_BOOTSTRAP_ADMIN_ID?.trim() ?? process.env.AUTH_USERNAME?.trim() ?? "",
  );
  const bootstrapPassword =
    process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD?.trim() ?? process.env.AUTH_PASSWORD?.trim() ?? "";

  if (!bootstrapId || !bootstrapPassword) return existing;

  const seeded: AuthUser = {
    id: bootstrapId,
    password_hash: hashPassword(bootstrapPassword),
    role: "super_admin",
    created_at: new Date().toISOString(),
  };
  await saveUsers([seeded]);
  return [seeded];
}

export async function createUser(input: { id: string; password: string; role?: SessionRole }) {
  const id = normalizeUserId(input.id);
  const password = input.password ?? "";
  const role = input.role ?? "user";
  if (!id) throw new Error("ID tài khoản không hợp lệ.");
  if (password.length < 8) throw new Error("Mật khẩu tối thiểu 8 ký tự.");

  const users = await getUsers();
  const exists = users.some((u) => u.id === id);
  if (exists) throw new Error("Tài khoản đã tồn tại.");

  const user: AuthUser = {
    id,
    password_hash: hashPassword(password),
    role,
    created_at: new Date().toISOString(),
  };
  users.push(user);
  await saveUsers(users);
  return user;
}

export async function authenticateUser(id: string, password: string) {
  const userId = normalizeUserId(id);
  if (!userId || !password) return null;

  const users = await getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return user;
}

export async function createSessionForUser(user: AuthUser) {
  const payload: SessionPayload = {
    uid: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  return createSessionToken(payload, authSecret());
}

export async function verifySessionFromCookie(cookieValue: string | undefined) {
  return verifySessionToken(cookieValue, authSecret());
}
