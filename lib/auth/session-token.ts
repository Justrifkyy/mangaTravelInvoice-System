/**
 * Penandatanganan dan verifikasi token sesi berbasis Web Crypto API (HMAC-SHA256).
 * Kompatibel di Node.js 24, Next.js 16 Proxy, Server Components, Route Handlers, dan Vitest.
 */

import type { UserRoleType } from "@/lib/db/types";

export const SESSION_COOKIE_NAME = "manga_session";
export const SESSION_IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 jam tidak aktif (F-01 > rules)

export interface SessionTokenPayload {
  userId: string;
  role: UserRoleType;
  iat: number;
  exp: number;
}

export type VerifyTokenResult =
  | { status: "valid"; payload: SessionTokenPayload }
  | { status: "expired" }
  | { status: "invalid" };

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    "manga-travel-dev-session-secret-change-in-production-2026"
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(str: string): Uint8Array | null {
  try {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    const base64 = padded + "=".repeat(padLen);
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(params: {
  userId: string;
  role: UserRoleType;
  nowMs?: number;
  ttlMs?: number;
}): Promise<string> {
  const now = params.nowMs ?? Date.now();
  const ttl = params.ttlMs ?? SESSION_IDLE_TIMEOUT_MS;
  const payload: SessionTokenPayload = {
    userId: params.userId,
    role: params.role,
    iat: now,
    exp: now + ttl,
  };

  const enc = new TextEncoder();
  const payloadB64 = toBase64Url(enc.encode(JSON.stringify(payload)));
  const key = await getHmacKey();
  const sigBuf = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(payloadB64)
  );
  const sigB64 = toBase64Url(new Uint8Array(sigBuf));

  return `${payloadB64}.${sigB64}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  nowMs: number = Date.now()
): Promise<VerifyTokenResult> {
  if (!token || typeof token !== "string") {
    return { status: "invalid" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { status: "invalid" };
  }

  const [payloadB64, sigB64] = parts;
  const sigBytes = fromBase64Url(sigB64);
  const payloadBytes = fromBase64Url(payloadB64);
  if (!sigBytes || !payloadBytes) {
    return { status: "invalid" };
  }

  const key = await getHmacKey();
  const enc = new TextEncoder();
  const isValidSig = await globalThis.crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    enc.encode(payloadB64)
  );

  if (!isValidSig) {
    return { status: "invalid" };
  }

  try {
    const decoded = JSON.parse(
      new TextDecoder().decode(payloadBytes)
    ) as SessionTokenPayload;

    if (
      !decoded ||
      typeof decoded.userId !== "string" ||
      (decoded.role !== "admin" && decoded.role !== "agent") ||
      typeof decoded.exp !== "number"
    ) {
      return { status: "invalid" };
    }

    if (decoded.exp <= nowMs) {
      return { status: "expired" };
    }

    return { status: "valid", payload: decoded };
  } catch {
    return { status: "invalid" };
  }
}

export function getSessionCookieOptions(maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds ?? Math.floor(SESSION_IDLE_TIMEOUT_MS / 1000),
  };
}

