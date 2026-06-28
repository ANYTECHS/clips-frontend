/**
 * Server-side rate limiting middleware.
 *
 * Uses an in-memory token bucket keyed by IP address (or user id when
 * available). Not shared across multiple Node.js processes — swap the backing
 * store for Redis in multi-instance production deployments.
 *
 * Returns standard rate-limit response headers on every request:
 *   X-RateLimit-Limit     — max requests allowed per window
 *   X-RateLimit-Remaining — requests remaining in current window
 *   Retry-After           — seconds until limit resets (only on 429)
 */

import { NextRequest, NextResponse } from "next/server";

interface BucketEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, BucketEntry>();

export interface RateLimitOptions {
  /** Maximum number of requests per window. Default: 60 */
  limit?: number;
  /** Window duration in milliseconds. Default: 60_000 (1 minute) */
  windowMs?: number;
}

/**
 * Apply rate limiting to a route handler.
 *
 * @example
 * export async function POST(req: NextRequest) {
 *   const limited = applyRateLimit(req, { limit: 10, windowMs: 60_000 });
 *   if (limited) return limited;
 *   // ... handler logic
 * }
 */
export function applyRateLimit(
  request: NextRequest,
  options: RateLimitOptions = {}
): NextResponse | null {
  const { limit = 60, windowMs = 60_000 } = options;

  const key = getClientKey(request);
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;
  const remaining = Math.max(0, limit - entry.count);

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  // Not rate-limited — caller can add headers to their own response via the
  // helper below if needed, but returning null signals "proceed".
  return null;
}

/**
 * Returns rate-limit headers to include on a successful (non-429) response.
 * Call after applyRateLimit returns null to attach the info headers.
 */
export function getRateLimitHeaders(
  request: NextRequest,
  options: RateLimitOptions = {}
): Record<string, string> {
  const { limit = 60, windowMs = 60_000 } = options;
  const key = getClientKey(request);
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    return {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(limit),
    };
  }
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, limit - entry.count)),
  };
}

/** Derives a bucketing key from the request. Uses forwarded IP or fallback. */
function getClientKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Exposed for testing only — clears all buckets. */
export function __resetRateLimitStore(): void {
  store.clear();
}
