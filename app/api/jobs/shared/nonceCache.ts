/**
 * nonceCache — replay protection for the AI backend callback.
 *
 * Tracks nonces that have already been used so a captured callback request
 * can't be replayed. Backed by Redis (shared TTL across instances) when
 * REDIS_URL is configured; falls back to an in-process map otherwise.
 */

import Redis from "ioredis";

const NONCE_TTL_SECONDS = 120;
const memoryNonces = new Map<string, number>();

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (process.env.NODE_ENV === "test" || !process.env.REDIS_URL) return null;
  if (!redisClient) redisClient = new Redis(process.env.REDIS_URL);
  return redisClient;
}

function pruneMemoryNonces(): void {
  const now = Date.now();
  for (const [nonce, expiresAt] of memoryNonces) {
    if (expiresAt <= now) memoryNonces.delete(nonce);
  }
}

/**
 * Atomically records a nonce if it hasn't been seen in the last
 * NONCE_TTL_SECONDS. Returns true the first time a nonce is seen, false if
 * it's a replay.
 */
export async function consumeNonce(nonce: string): Promise<boolean> {
  const redis = getRedisClient();
  if (redis) {
    const result = await redis.set(
      `callback-nonce:${nonce}`,
      "1",
      "EX",
      NONCE_TTL_SECONDS,
      "NX"
    );
    return result === "OK";
  }

  pruneMemoryNonces();
  if (memoryNonces.has(nonce)) return false;
  memoryNonces.set(nonce, Date.now() + NONCE_TTL_SECONDS * 1000);
  return true;
}
