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
import Redis from "ioredis";
import { logger } from "@/app/lib/logger";

interface BucketEntry {
  count: number;
  resetAt: number;
}

interface StorageAdapter {
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<number>;
}

class RedisStorageAdapter implements StorageAdapter {
  constructor(private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }
}

class InMemoryStorageAdapter implements StorageAdapter {
  private readonly map = new Map<string, { count: number; resetAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now >= entry.resetAt) {
      this.map.delete(key);
      return null;
    }
    return JSON.stringify(entry);
  }

  async incr(key: string): Promise<number> {
    const entry = this.map.get(key);
    const now = Date.now();
    if (!entry || now >= entry.resetAt) {
      this.map.set(key, { count: 1, resetAt: Date.now() + 60000 });
      return 1;
    }
    entry.count++;
    return entry.count;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.map.get(key);
    if (!entry) return 0;
    entry.resetAt = Date.now() + seconds * 1000;
    return 1;
  }

  async del(key: string): Promise<number> {
    return this.map.delete(key) ? 1 : 0;
  }
}

let adapter: StorageAdapter;

function getAdapter(): StorageAdapter {
  if (adapter) return adapter;

  if (process.env.NODE_ENV === "test") {
    adapter = new InMemoryStorageAdapter();
    return adapter;
  }

  if (!process.env.REDIS_URL) {
    adapter = new InMemoryStorageAdapter();
    return adapter;
  }

  try {
    const redis = new Redis(process.env.REDIS_URL);
    adapter = new RedisStorageAdapter(redis);
    return adapter;
  } catch (error) {
    logger.warn(
      "[serverRateLimit] Failed to initialize Redis client, falling back to in-memory storage:",
      error
    );
    adapter = new InMemoryStorageAdapter();
    return adapter;
  }
}

export interface RateLimitOptions {
  /** Maximum number of requests per window. Default: 60 */
  limit?: number;
  /** Window duration in milliseconds. Default: 60_000 (1 minute) */
  windowMs?: number;
  /**
   * Overrides the bucketing key (defaults to the client's IP address).
   * Pass a user-scoped key (e.g. `user:<id>:<route>`) for per-user rate
   * limits — see app/lib/customRateLimit.ts.
   */
  key?: string;
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
export async function applyRateLimit(
  request: NextRequest,
  options: RateLimitOptions = {}
): Promise<NextResponse | null> {
  const { limit = 60, windowMs = 60_000 } = options;

  const key = options.key ?? getClientKey(request);
  const storage = getAdapter();
  const windowSeconds = Math.ceil(windowMs / 1000);

  await storage.get(key);

  // Use Redis atomic increment with TTL
  const count = await storage.incr(key);
  
  // Set TTL on first request (when count is 1)
  if (count === 1) {
    await storage.expire(key, windowSeconds);
  }

  const rawAfterIncrement = await storage.get(key);
  const resetAt = parseResetAt(rawAfterIncrement, windowMs);
  const remaining = Math.max(0, limit - count);

  if (count > limit) {
    const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    return NextResponse.json(
      {
        error: "Too many requests",
        code: "RATE_LIMITED",
        rateLimit: {
          limit,
          remaining: 0,
          resetAt,
          retryAfter,
        },
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
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
export async function getRateLimitHeaders(
  request: NextRequest,
  options: RateLimitOptions = {}
): Promise<Record<string, string>> {
  const { limit = 60, windowMs = 60_000 } = options;
  const key = options.key ?? getClientKey(request);
  const storage = getAdapter();

  const raw = await storage.get(key);
  if (!raw) {
    const resetEpoch = Math.ceil((Date.now() + windowMs) / 1000);
    return {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(limit),
      "X-RateLimit-Reset": String(resetEpoch),
    };
  }

  const entry = parseBucketEntry(raw, windowMs);
  const now = Date.now();
  if (now >= entry.resetAt) {
    const resetEpoch = Math.ceil((now + windowMs) / 1000);
    return {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(limit),
      "X-RateLimit-Reset": String(resetEpoch),
    };
  }

  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, limit - entry.count)),
    "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
  };
}

function parseBucketEntry(raw: string | null, windowMs: number): BucketEntry {
  if (!raw) return { count: 0, resetAt: Date.now() + windowMs };

  try {
    const parsed = JSON.parse(raw) as Partial<BucketEntry>;
    if (typeof parsed.count === "number" && typeof parsed.resetAt === "number") {
      return { count: parsed.count, resetAt: parsed.resetAt };
    }
  } catch {}

  const count = Number(raw);
  return {
    count: Number.isFinite(count) ? count : 0,
    resetAt: Date.now() + windowMs,
  };
}

function parseResetAt(raw: string | null, windowMs: number): number {
  return parseBucketEntry(raw, windowMs).resetAt;
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
export async function __resetRateLimitStore(): Promise<void> {
  const storage = getAdapter();
  if (storage instanceof InMemoryStorageAdapter) {
    // Test-only helper - access private property - use as any
    (storage as any).map.clear();
  } else {
    // For Redis, we'd need to flush by pattern, but for now just warn
    logger.warn("[serverRateLimit] Cannot reset Redis store in tests");
  }
}
