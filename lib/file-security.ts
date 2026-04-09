"use server";

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { cookies } from "next/headers";
import { verifySessionFromCookie, authSecret } from "./auth";

// Encryption key derived from AUTH_SECRET
function getEncryptionKey(): Buffer {
  const secret = authSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET not configured");
  }
  return scryptSync(secret, "file-encryption-salt", 32);
}

// Encrypt file content using AES-256-GCM
export function encryptFileContent(content: Buffer): { encrypted: string; iv: string; authTag: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  
  const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

// Decrypt file content
export function decryptFileContent(encrypted: string, iv: string, authTag: string): Buffer {
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]);
  
  return decrypted;
}

// Verify user authentication from cookie
export async function verifyFileAccess(): Promise<{ uid: string; role: string } | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("st_session")?.value;
  
  if (!sessionCookie) return null;
  
  const session = await verifySessionFromCookie(sessionCookie);
  if (!session) return null;
  
  return { uid: session.uid, role: session.role };
}

// Check if user has permission to access files
export async function checkFilePermission(requiredRole: "user" | "admin" | "super_admin" = "user"): Promise<boolean> {
  const session = await verifyFileAccess();
  if (!session) return false;
  
  const roleHierarchy = { user: 1, admin: 2, super_admin: 3 };
  const userLevel = roleHierarchy[session.role as keyof typeof roleHierarchy] || 0;
  const requiredLevel = roleHierarchy[requiredRole];
  
  return userLevel >= requiredLevel;
}
