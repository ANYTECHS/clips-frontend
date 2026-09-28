import crypto from "crypto";

export interface ApiJwtPayload {
  sub: string; // User ID
  email?: string;
  scopes?: string[];
  name?: string;
  iat?: number;
  exp?: number;
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

/**
 * Returns the JWT signing secret from environment configuration.
 * Never hardcodes secrets in source code.
 */
export function getJwtSecret(): string {
  const secret = process.env.API_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("API_JWT_SECRET or NEXTAUTH_SECRET must be configured in production");
    }
    return "dev-insecure-jwt-secret-do-not-use-in-production-32chars";
  }
  return secret;
}

function base64UrlEncode(input: string | Buffer): string {
  const base64 = Buffer.isBuffer(input) ? input.toString("base64") : Buffer.from(input).toString("base64");
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Generates a signed JSON Web Token (HMAC-SHA256).
 */
export function generateApiJwt(
  payload: Omit<ApiJwtPayload, "iat" | "exp"> & { exp?: number; iat?: number },
  options: JwtSignOptions = {}
): string {
  const secret = options.secret ?? getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = options.expiresInSeconds ?? 3600; // Default: 1 hour

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const fullPayload: ApiJwtPayload = {
    ...payload,
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
  const encodedSignature = base64UrlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}

/**
 * Validates a JWT and verifies its cryptographic signature and expiration.
 */
export function verifyApiJwt(token: string, options: JwtVerifyOptions = {}): JwtVerificationResult {
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
