import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createSessionToken, type SessionPayload, type SessionRole, verifySessionToken } from "./session";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

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

function hasConfig() {
  return Boolean(authSecret() && supabaseUrl && supabaseKey);
}

function getClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Thiếu cấu hình Supabase");
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

export function authConfigured() {
  return hasConfig();
}

export async function getUsers() {
  if (!hasConfig()) return [];
  const supabase = getClient();
  const { data, error } = await supabase.from("users").select("*");
  if (error) {
    console.error("getUsers error:", error);
    return [];
  }
  return data?.map((u: Record<string, unknown>) => ({
    id: String(u.id),
    password_hash: String(u.password_hash),
    role: String(u.role) as SessionRole,
    created_at: String(u.created_at),
  })) ?? [];
}

async function saveUsers(users: AuthUser[]) {
  const supabase = getClient();
  // Xóa tất cả và insert mới
  await supabase.from("users").delete().neq("id", "placeholder");
  if (users.length > 0) {
    const { error } = await supabase.from("users").insert(
      users.map((u) => ({
        id: u.id,
        password_hash: u.password_hash,
        role: u.role,
        created_at: u.created_at,
      }))
    );
    if (error) throw error;
  }
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
  if (users.some((u) => u.id === id)) {
    throw new Error("Tài khoản đã tồn tại.");
  }

  const newUser: AuthUser = {
    id,
    password_hash: hashPassword(password),
    role,
    created_at: new Date().toISOString(),
  };

  await saveUsers([...users, newUser]);
  return newUser;
}

export async function deleteUser(id: string) {
  const normalizedId = normalizeUserId(id);
  const users = await getUsers();
  const filtered = users.filter((u) => u.id !== normalizedId);
  if (filtered.length === users.length) {
    throw new Error("Không tìm thấy tài khoản.");
  }
  await saveUsers(filtered);
}

export async function verifyUser(id: string, password: string) {
  const normalizedId = normalizeUserId(id);
  const users = await getUsers();
  const user = users.find((u) => u.id === normalizedId);
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return user;
}

export async function login(id: string, password: string): Promise<{ token: string; user: Omit<AuthUser, "password_hash"> } | null> {
  const user = await verifyUser(id, password);
  if (!user) return null;

  const payload: SessionPayload = {
    uid: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 ngày
  };

  const token = createSessionToken(payload, authSecret());
  const { password_hash: _, ...userWithoutHash } = user;
  return { token, user: userWithoutHash };
}

export async function changePassword(id: string, currentPassword: string, newPassword: string) {
  if (newPassword.length < 8) throw new Error("Mật khẩu mới tối thiểu 8 ký tự.");
  const user = await verifyUser(id, currentPassword);
  if (!user) throw new Error("Mật khẩu hiện tại không đúng.");

  const users = await getUsers();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx === -1) throw new Error("Không tìm thấy tài khoản.");

  users[idx].password_hash = hashPassword(newPassword);
  await saveUsers(users);
}
