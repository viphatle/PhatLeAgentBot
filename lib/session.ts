export const AUTH_COOKIE_NAME = "st_session";

export type SessionRole = "user" | "admin" | "super_admin";

export type SessionPayload = {
  uid: string;
  role: SessionRole;
  exp: number;
};

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSha256Base64Url(data: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bytesToBase64Url(new Uint8Array(sig));
}

export async function createSessionToken(payload: SessionPayload, secret: string) {
  const data = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await hmacSha256Base64Url(data, secret);
  return `${data}.${sig}`;
}

export async function verifySessionToken(token: string | undefined, secret: string) {
  if (!token || !secret) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = await hmacSha256Base64Url(data, secret);
  if (sig !== expected) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(data))) as SessionPayload;
    if (!payload?.uid || !payload?.role || !payload?.exp) return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
