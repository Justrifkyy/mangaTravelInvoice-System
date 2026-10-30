/**
 * Pembatasan percobaan login gagal (rate limit) di memori server.
 * Sumber: docs/app-spec.json > features.F-01.rules & non_functional.security
 */

interface AttemptBucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 10 * 60 * 1000; // 10 menit
const MAX_FAILED_ATTEMPTS = 5;

const attemptMap = new Map<string, AttemptBucket>();

export function checkLoginRateLimit(key: string, nowMs = Date.now()): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const normalizedKey = key.trim().toLowerCase();
  const bucket = attemptMap.get(normalizedKey);
  if (!bucket || bucket.resetAt <= nowMs) {
    if (bucket) attemptMap.delete(normalizedKey);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= MAX_FAILED_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - nowMs) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLoginAttempt(key: string, nowMs = Date.now()): void {
  const normalizedKey = key.trim().toLowerCase();
  const existing = attemptMap.get(normalizedKey);
  if (!existing || existing.resetAt <= nowMs) {
    attemptMap.set(normalizedKey, {
      count: 1,
      resetAt: nowMs + WINDOW_MS,
    });
    return;
  }
  existing.count += 1;
}

export function clearFailedLoginAttempts(key: string): void {
  attemptMap.delete(key.trim().toLowerCase());
}

