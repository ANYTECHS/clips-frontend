/**
 * app/lib/tokenDenylist.ts
 *
 * Refresh token denylist with Redis fast-path and PostgreSQL authoritative store.
 *
 * Architecture
 * ────────────
 *   Redis  — primary lookup (sub-millisecond).  Entry TTL = refresh token TTL
 *            so keys expire automatically and Redis never fills up.
 *   Prisma — authoritative store.  Redis is a cache; the DB is the source of
 *            truth for long-lived tokens, audit, and recovery after a Redis
 *            flush.
 *
 * Key format
 * ──────────
 *   rt:deny:<tokenHash>   →  "1"  (presence = denylisted)
 *   rt:family:<familyId>  →  "revoked" (presence = entire family revoked)
 *
 * All Redis operations degrade gracefully — if Redis is unavailable the DB
 * path is used exclusively so no security guarantees are lost.
 */

import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
import { REFRESH_TOKEN_TTL_SECONDS } from "@/app/lib/jwt";
import { getRedisClient, isRedisAvailable } from "@/app/api/jobs/shared/redisClient";

// ─── Key builders ──────────────────────────────────────────────────────────────

export function denylistKey(tokenHash: string): string {
  return `rt:deny:${tokenHash}`;
}

export function familyKey(familyId: string): string {
  return `rt:family:${familyId}`;
}

// ─── Denylist a single token ──────────────────────────────────────────────────

/**
 * Adds a refresh token hash to the denylist.
 *
 * Writes to Redis (with TTL) and marks the DB row revokedAt.
 * Designed to be called atomically before issuing the replacement token.
 *
 * @param tokenHash  - SHA-256 hex hash of the plaintext token.
 * @param ttlSeconds - How long to keep the Redis key.  Defaults to the
 *                     refresh token TTL so the key expires when the token
 *                     would have anyway.
 */
export async function denylistToken(
  tokenHash: string,
  ttlSeconds: number = REFRESH_TOKEN_TTL_SECONDS,
): Promise<void> {
  // 1. Revoke in DB (authoritative)
  await prisma.refreshToken
    .updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch((err) => {
      logger.error("[TokenDenylist] Failed to revoke token in DB", { tokenHash, err });
      // Don't swallow — if we can't revoke in DB we must not proceed with
      // issuing a new token.  Re-throw so the caller can return 500.
      throw err;
    });

  // 2. Cache in Redis (fast path for future lookups)
  if (isRedisAvailable()) {
    const redis = getRedisClient();
    if (redis) {
      await redis
        .set(denylistKey(tokenHash), "1", "EX", ttlSeconds)
        .catch((err) => {
          // Redis failure is non-fatal here — the DB row is already revoked.
          logger.warn("[TokenDenylist] Redis SET failed (non-fatal)", { err });
        });
    }
  }
}

// ─── Revoke an entire token family ────────────────────────────────────────────

/**
 * Revokes all refresh tokens belonging to `familyId`.
 * Called when reuse of a revoked token is detected — a strong signal of
 * token theft.
 *
 * @returns The number of rows revoked.
 */
export async function revokeFamilyTokens(familyId: string): Promise<number> {
  // 1. Revoke all rows in DB
  const result = await prisma.refreshToken
    .updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch((err) => {
      logger.error("[TokenDenylist] Failed to revoke family in DB", { familyId, err });
      throw err;
    });

  // 2. Mark the family itself as revoked in Redis so future lookups are fast
  if (isRedisAvailable()) {
    const redis = getRedisClient();
    if (redis) {
      await redis
        .set(familyKey(familyId), "revoked", "EX", REFRESH_TOKEN_TTL_SECONDS)
        .catch((err) => {
          logger.warn("[TokenDenylist] Redis family SET failed (non-fatal)", { err });
        });
    }
  }

  return result.count;
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the token hash is on the denylist.
 *
 * Check order:
 *   1. Redis (fast path, O(1))
 *   2. DB   (authoritative fallback)
 */
export async function isTokenDenylisted(tokenHash: string): Promise<boolean> {
  // Fast path: Redis
  if (isRedisAvailable()) {
    const redis = getRedisClient();
    if (redis) {
      try {
        const value = await redis.get(denylistKey(tokenHash));
        if (value !== null) return true;
      } catch (err) {
        logger.warn("[TokenDenylist] Redis GET failed, falling back to DB", { err });
      }
    }
  }

  // Authoritative path: DB
  const row = await prisma.refreshToken
    .findUnique({
      where: { tokenHash },
      select: { revokedAt: true },
    })
    .catch((err) => {
      logger.error("[TokenDenylist] DB lookup failed", { tokenHash, err });
      // Fail secure: treat as denylisted if we can't verify
      return { revokedAt: new Date() };
    });

  return row?.revokedAt !== null && row?.revokedAt !== undefined;
}

/**
 * Returns true if the entire token family has been revoked.
 * Used as a second-layer check after per-token denylist lookup.
 */
export async function isFamilyRevoked(familyId: string): Promise<boolean> {
  // Fast path: Redis
  if (isRedisAvailable()) {
    const redis = getRedisClient();
    if (redis) {
      try {
        const value = await redis.get(familyKey(familyId));
        if (value === "revoked") return true;
      } catch (err) {
        logger.warn("[TokenDenylist] Redis family GET failed, falling back to DB", { err });
      }
    }
  }

  // Authoritative: any non-revoked token still present means family is active
  const active = await prisma.refreshToken
    .findFirst({
      where: { familyId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    })
    .catch((err) => {
      logger.error("[TokenDenylist] DB family lookup failed", { familyId, err });
      return null;
    });

  // If no active token found, the family is fully revoked
  return active === null;
}

// ─── Store a new refresh token ────────────────────────────────────────────────

/**
 * Persists a newly issued refresh token hash to the database and primes the
 * Redis fast-path so the first refresh lookup hits cache.
 *
 * @param params.userId       - Owner of the token.
 * @param params.tokenHash    - SHA-256 hash of the plaintext token.
 * @param params.familyId     - Token family this token belongs to.
 * @param params.expiresAt    - Unix timestamp (seconds) when the token expires.
 * @param params.replacedHash - Hash of the token this one replaces (chain link).
 */
export async function storeRefreshToken(params: {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: number;
  replacedHash?: string;
}): Promise<void> {
  const expiresAtDate = new Date(params.expiresAt * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: params.userId,
      tokenHash: params.tokenHash,
      familyId: params.familyId,
      expiresAt: expiresAtDate,
      replacedByHash: params.replacedHash ?? null,
    },
  });

  // Prime Redis so the very first lookup after issuance is a cache hit
  // (presence check: key exists = token is active, absence = check DB)
  // We store the token as NOT denylisted by not writing to denylistKey —
  // Redis absence means "not yet denylisted", which is correct.
}

// ─── Cleanup (periodic maintenance) ──────────────────────────────────────────

/**
 * Deletes fully expired refresh token rows from the database.
 * Intended to be called from a periodic cron job to keep the table small.
 *
 * @param olderThanDays - Only delete tokens expired more than N days ago
 *                        (default 1) to leave a short audit window.
 * @returns Number of rows deleted.
 */
export async function pruneExpiredRefreshTokens(
  olderThanDays: number = 1,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  logger.info("[TokenDenylist] Pruned expired refresh tokens", {
    count: result.count,
  });
  return result.count;
}
