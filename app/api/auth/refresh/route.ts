/**
 * POST /api/auth/refresh
 *
 * Refresh token rotation endpoint.
 *
 * Request
 * ───────
 *   The refresh token is read from the httpOnly cookie `rt` (set by this
 *   endpoint on first issuance).  No body is required.
 *
 * Happy path
 * ──────────
 *   1. Extract refresh token from cookie.
 *   2. Hash it and look up the DB row.
 *   3. Verify the token is not expired and not revoked / denylisted.
 *   4. Atomically:
 *        a. Denylist the old token hash (DB revokedAt + Redis key).
 *        b. Issue a new access token + new refresh token (same familyId).
 *        c. Store the new refresh token hash in DB.
 *   5. Return the new access token in the JSON body.
 *   6. Set the new refresh token as an httpOnly Secure SameSite=Strict cookie.
 *
 * Reuse detection
 * ───────────────
 *   If the presented token hash is already revoked (it was previously rotated),
 *   the attacker has a copy of an old refresh token.  We revoke the **entire
 *   family** and return 401, forcing full re-authentication.
 *
 * Security properties
 * ───────────────────
 *   - Refresh token is httpOnly + Secure + SameSite=Strict → not readable by JS
 *   - Access token returned in JSON body → stored in memory by the client
 *   - Old token hash is denylisted before the new token is issued (no gap)
 *   - Reuse detection revokes all family tokens, not just the presented one
 *   - Rate limiting deferred to the outer middleware (serverRateLimit)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";
import { createAuditEvent } from "@/app/lib/auditLog";
import {
  hashRefreshToken,
  issueTokenPair,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/app/lib/jwt";
import {
  isTokenDenylisted,
  denylistToken,
  revokeFamilyTokens,
  storeRefreshToken,
} from "@/app/lib/tokenDenylist";

// ─── Cookie name constants ─────────────────────────────────────────────────────

export const REFRESH_TOKEN_COOKIE = "rt";

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Builds the Set-Cookie header value for the refresh token.
 * httpOnly + Secure (prod) + SameSite=Strict prevents CSRF and XSS theft.
 */
function buildRefreshCookie(plaintext: string, maxAgeSeconds: number): string {
  const parts = [
    `${REFRESH_TOKEN_COOKIE}=${plaintext}`,
    `Max-Age=${maxAgeSeconds}`,
    "Path=/api/auth/refresh",   // Scoped: cookie only sent to this endpoint
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (IS_PROD) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Builds a cookie that immediately expires (used to clear the refresh token
 * on reuse detection or deliberate logout).
 */
function buildClearCookie(): string {
  const parts = [
    `${REFRESH_TOKEN_COOKIE}=`,
    "Max-Age=0",
    "Path=/api/auth/refresh",
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (IS_PROD) parts.push("Secure");
  return parts.join("; ");
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // ── 1. Extract refresh token from httpOnly cookie ──────────────────────────
  const plaintext =
    req.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

  if (!plaintext) {
    return NextResponse.json(
      { error: "No refresh token provided" },
      { status: 401 },
    );
  }

  const tokenHash = hashRefreshToken(plaintext);

  // ── 2. Look up the DB row ──────────────────────────────────────────────────
  const storedToken = await prisma.refreshToken
    .findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        familyId: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { email: true } },
      },
    })
    .catch((err) => {
      logger.error("[Refresh] DB lookup failed", { err });
      return null;
    });

  if (!storedToken) {
    // Token hash not in DB — either never issued or already pruned.
    return NextResponse.json(
      { error: "Invalid refresh token" },
      { status: 401 },
    );
  }

  // ── 3a. Check expiry ───────────────────────────────────────────────────────
  if (storedToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Refresh token expired" },
      { status: 401 },
    );
  }

  // ── 3b. Check denylist / reuse detection ──────────────────────────────────
  const isRevoked = storedToken.revokedAt !== null;
  const isDenylisted = await isTokenDenylisted(tokenHash);

  if (isRevoked || isDenylisted) {
    // SECURITY: A previously rotated (revoked) token was presented.
    // This is a strong signal of token theft — revoke the entire family.
    logger.warn("[Refresh] REUSE DETECTED — revoking token family", {
      familyId: storedToken.familyId,
      userId: storedToken.userId,
      ip,
    });

    await revokeFamilyTokens(storedToken.familyId).catch((err) => {
      logger.error("[Refresh] Failed to revoke family during reuse detection", {
        err,
      });
    });

    await createAuditEvent({
      actorId: storedToken.userId,
      action: "auth.refresh_token_reuse",
      resource: "refresh_token",
      resourceId: storedToken.id,
      ipAddress: ip,
      userAgent,
      status: "failure",
      metadata: {
        familyId: storedToken.familyId,
        reason: "Revoked token re-presented — possible token theft",
      },
    }).catch(() => {});

    const clearCookieHeader = buildClearCookie();
    return NextResponse.json(
      { error: "Token reuse detected. All sessions have been revoked." },
      {
        status: 401,
        headers: { "Set-Cookie": clearCookieHeader },
      },
    );
  }

  // ── 4. Rotate: denylist old → issue new pair ───────────────────────────────
  const { userId, familyId } = storedToken;
  const email = storedToken.user?.email ?? "";

  // a. Denylist the old token atomically (throws on DB failure)
  try {
    await denylistToken(tokenHash, REFRESH_TOKEN_TTL_SECONDS);
  } catch (err) {
    logger.error("[Refresh] Failed to denylist old token", { err });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  // b. Issue new access + refresh token pair (same familyId = same chain)
  const { accessToken, refresh: newRefresh } = issueTokenPair(
    userId,
    email,
    familyId,
  );

  // c. Store new refresh token hash in DB (links back to old hash)
  try {
    await storeRefreshToken({
      userId,
      tokenHash: newRefresh.hash,
      familyId,
      expiresAt: newRefresh.expiresAt,
      replacedHash: tokenHash,
    });
  } catch (err) {
    logger.error("[Refresh] Failed to store new refresh token", { err });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  // ── 5. Audit trail ────────────────────────────────────────────────────────
  await createAuditEvent({
    actorId: userId,
    action: "auth.token_rotated",
    resource: "refresh_token",
    ipAddress: ip,
    userAgent,
    status: "success",
    metadata: { familyId },
  }).catch(() => {});

  // ── 6. Respond ────────────────────────────────────────────────────────────
  const cookieHeader = buildRefreshCookie(
    newRefresh.plaintext,
    REFRESH_TOKEN_TTL_SECONDS,
  );

  return NextResponse.json(
    {
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    },
    {
      status: 200,
      headers: { "Set-Cookie": cookieHeader },
    },
  );
}
