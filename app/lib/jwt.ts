/**
 * app/lib/jwt.ts
 *
 * Hand-rolled HS256 JWT implementation + opaque refresh token utilities.
 *
 * Token model
 * ───────────
 *   Access token  – short-lived signed JWT (default 15 min).  Carried in the
 *                   Authorization header.  Verified by verifyApiJwt().
 *   Refresh token – cryptographically random opaque string (32 bytes hex,
 *                   never a JWT).  Stored as an httpOnly cookie.  Only its
 *                   SHA-256 hash is persisted in the database / Redis.
 *
 * Rotation scheme
 * ───────────────
 *   1. Client presents refresh token → POST /api/auth/refresh
 *   2. Server looks up token hash in denylist (Redis) then DB.
 *      - If denylisted → reuse detected → revoke entire family → 401.
 *      - If not found or expired → 401.
 *   3. Server revokes old token (adds hash to denylist + sets revokedAt in DB).
 *   4. Server issues new access token + new refresh token (same familyId).
 *   5. New refresh token hash stored in DB; old row's replacedByHash updated.
 *
 * Family tracking
 * ───────────────
 *   Every refresh token row carries a familyId (the id of the first token in
 *   the chain).  On reuse detection all rows WHERE familyId = X are revoked,
 *   forcing the user to re-authenticate from scratch.
 */

import crypto from "crypto";

// ─── Re-export existing types so consumers don't need to change imports ───────

export interface ApiJwtPayload {
  sub: string;         // User ID
  email?: string;
  scopes?: string[];
  name?: string;
  iat?: number;
  exp?: number;
  /** Token type discriminator — "access" (default) keeps backward compat. */
  type?: "access";
  [key: string]: unknown;
}

export interface JwtSignOptions {
  expiresInSeconds?: number;
  secret?: string;
}

export interface JwtVerifyOptions {
  secret?: string;
  clockToleranceSeconds?: number;
}

export interface JwtVerificationResult {
  valid: boolean;
  payload?: ApiJwtPayload;
  error?: "expired" | "malformed" | "invalid_signature" | "missing_token";
}

// ─── New types for refresh token rotation ─────────────────────────────────────

export interface RefreshTokenBundle {
  /** The opaque plaintext refresh token (send to client, never store). */
  plaintext: string;
  /** SHA-256 hex hash of plaintext (store in DB / Redis). */
  hash: string;
  /** All tokens in this chain share the same familyId. */
  familyId: string;
  /** Absolute expiry timestamp (Unix seconds). */
  expiresAt: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires (for client-side timers). */
  accessExpiresIn: number;
  /** Unix timestamp (seconds) when the refresh token expires. */
  refreshExpiresAt: number;
}

// ─── TTL constants (overridable via env) ──────────────────────────────────────

/** Access token lifetime — default 15 minutes. */
export const ACCESS_TOKEN_TTL_SECONDS = parseInt(
  process.env.JWT_ACCESS_TOKEN_EXPIRES_IN ?? "900",
  10,
);

/** Refresh token lifetime — default 7 days. */
export const REFRESH_TOKEN_TTL_SECONDS = parseInt(
  process.env.JWT_REFRESH_TOKEN_EXPIRES_IN ?? String(7 * 24 * 60 * 60),
  10,
);

// ─── Secret resolution ────────────────────────────────────────────────────────

/**
 * Returns the JWT signing secret from environment configuration.
 * Preference order: API_JWT_SECRET > NEXTAUTH_SECRET > dev fallback.
 */
export function getJwtSecret(): string {
  const secret = process.env.API_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "API_JWT_SECRET or NEXTAUTH_SECRET must be configured in production",
      );
    }
    return "dev-insecure-jwt-secret-do-not-use-in-production-32chars";
  }
  return secret;
}

// ─── Base64url helpers (private) ──────────────────────────────────────────────

function base64UrlEncode(input: string | Buffer): string {
  const base64 = Buffer.isBuffer(input)
    ? input.toString("base64")
    : Buffer.from(input).toString("base64");
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  return Buffer.from(base64, "base64").toString("utf8");
}

// ─── Access token (signed JWT) ───────────────────────────────────────────────

/**
 * Issues a short-lived access token (HS256 JWT).
 * Default TTL: {@link ACCESS_TOKEN_TTL_SECONDS} (15 min).
 */
export function generateApiJwt(
  payload: Omit<ApiJwtPayload, "iat" | "exp"> & { exp?: number; iat?: number },
  options: JwtSignOptions = {},
): string {
  const secret = options.secret ?? getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = options.expiresInSeconds ?? ACCESS_TOKEN_TTL_SECONDS;

  const header = { alg: "HS256", typ: "JWT" };

  const fullPayload: ApiJwtPayload = {
    ...payload,
    type: "access",
    iat: payload.iat ?? now,
    exp: payload.exp ?? now + expiresIn,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest();

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

/**
 * Verifies an access token JWT.
 *
 * Returns `payload` even when the token is expired so callers can read
 * `sub` / `email` for refresh token lookups without a second decode.
 */
export function verifyApiJwt(
  token: string,
  options: JwtVerifyOptions = {},
): JwtVerificationResult {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "missing_token" };
  }

  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "malformed" };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  let header: { alg?: string; typ?: string };
  let payload: ApiJwtPayload;

  try {
    header = JSON.parse(base64UrlDecode(encodedHeader));
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return { valid: false, error: "malformed" };
  }

  if (header.alg !== "HS256") {
    return { valid: false, error: "invalid_signature" };
  }

  const secret = options.secret ?? getJwtSecret();
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest();

  let actualSignature: Buffer;
  try {
    let sigBase64 = encodedSignature.replace(/-/g, "+").replace(/_/g, "/");
    while (sigBase64.length % 4 !== 0) sigBase64 += "=";
    actualSignature = Buffer.from(sigBase64, "base64");
  } catch {
    return { valid: false, error: "invalid_signature" };
  }

  if (
    actualSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return { valid: false, error: "invalid_signature" };
  }

  const now = Math.floor(Date.now() / 1000);
  const tolerance = options.clockToleranceSeconds ?? 0;

  if (payload.exp !== undefined && payload.exp + tolerance < now) {
    return { valid: false, error: "expired", payload };
  }

  return { valid: true, payload };
}

// ─── Opaque refresh token ─────────────────────────────────────────────────────

/**
 * Hashes an opaque refresh token with SHA-256.
 * Only the hash is stored — the plaintext is returned once and forgotten.
 */
export function hashRefreshToken(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

/**
 * Generates a new opaque refresh token bundle.
 *
 * @param familyId  - Omit to start a new family; pass existing value when
 *                    rotating so the chain shares the same familyId.
 */
export function generateRefreshToken(familyId?: string): RefreshTokenBundle {
  const plaintext = crypto.randomBytes(32).toString("hex");
  const hash = hashRefreshToken(plaintext);
  const resolvedFamilyId = familyId ?? crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS;

  return { plaintext, hash, familyId: resolvedFamilyId, expiresAt };
}

/**
 * Issues an access + refresh token pair for a user.
 *
 * @param sub       - User ID (JWT `sub` claim).
 * @param email     - User email (embedded in access token for convenience).
 * @param familyId  - Pass existing familyId when rotating; omit for a fresh
 *                    login to start a new family.
 * @param extraClaims - Additional claims to embed in the access token.
 */
export function issueTokenPair(
  sub: string,
  email: string,
  familyId?: string,
  extraClaims: Partial<ApiJwtPayload> = {},
): { accessToken: string; refresh: RefreshTokenBundle } {
  const accessToken = generateApiJwt(
    { sub, email, ...extraClaims },
    { expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS },
  );

  const refresh = generateRefreshToken(familyId);

  return { accessToken, refresh };
}
