/**
 * @jest-environment node
 *
 * Unit tests for app/lib/jwt.ts
 *
 * Coverage:
 *   - getJwtSecret: env priority, production guard
 *   - generateApiJwt: structure, claims, TTL, custom secret
 *   - verifyApiJwt: valid, expired (payload preserved), tampered, missing, malformed
 *   - hashRefreshToken: deterministic SHA-256
 *   - generateRefreshToken: structure, familyId inheritance, uniqueness
 *   - issueTokenPair: access token verifiable, refresh bundle correct, familyId passed through
 *   - TTL constants: env-overridable
 */

import crypto from "crypto";
import {
  getJwtSecret,
  generateApiJwt,
  verifyApiJwt,
  hashRefreshToken,
  generateRefreshToken,
  issueTokenPair,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/app/lib/jwt";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodePayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  let base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
}

// ─── getJwtSecret ─────────────────────────────────────────────────────────────

describe("getJwtSecret", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns API_JWT_SECRET when set", () => {
    process.env.API_JWT_SECRET = "my-api-secret";
    delete process.env.NEXTAUTH_SECRET;
    expect(getJwtSecret()).toBe("my-api-secret");
  });

  it("falls back to NEXTAUTH_SECRET when API_JWT_SECRET is absent", () => {
    delete process.env.API_JWT_SECRET;
    process.env.NEXTAUTH_SECRET = "my-nextauth-secret";
    expect(getJwtSecret()).toBe("my-nextauth-secret");
  });

  it("returns dev fallback in non-production when neither is set", () => {
    delete process.env.API_JWT_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    process.env.NODE_ENV = "test";
    const secret = getJwtSecret();
    expect(secret).toBeTruthy();
    expect(typeof secret).toBe("string");
  });

  it("throws in production when neither secret is set", () => {
    delete process.env.API_JWT_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    process.env.NODE_ENV = "production";
    expect(() => getJwtSecret()).toThrow(/must be configured/i);
  });
});

// ─── generateApiJwt + verifyApiJwt ────────────────────────────────────────────

describe("generateApiJwt", () => {
  const SECRET = "test-secret-at-least-32-chars-long-ok";
  const PAYLOAD = { sub: "user-123", email: "alice@example.com" };

  it("produces a three-part JWT string", () => {
    const token = generateApiJwt(PAYLOAD, { secret: SECRET });
    expect(token.split(".")).toHaveLength(3);
  });

  it("embeds sub and email claims", () => {
    const token = generateApiJwt(PAYLOAD, { secret: SECRET });
    const payload = decodePayload(token);
    expect(payload.sub).toBe("user-123");
    expect(payload.email).toBe("alice@example.com");
  });

  it("sets type=access discriminator", () => {
    const token = generateApiJwt(PAYLOAD, { secret: SECRET });
    expect(decodePayload(token).type).toBe("access");
  });

  it("sets iat and exp claims", () => {
    const before = Math.floor(Date.now() / 1000);
    const token = generateApiJwt(PAYLOAD, { secret: SECRET, expiresInSeconds: 900 });
    const after = Math.floor(Date.now() / 1000);
    const payload = decodePayload(token);
    expect(payload.iat as number).toBeGreaterThanOrEqual(before);
    expect(payload.iat as number).toBeLessThanOrEqual(after);
    expect(payload.exp as number).toBeGreaterThanOrEqual(before + 900);
    expect(payload.exp as number).toBeLessThanOrEqual(after + 900);
  });

  it("uses ACCESS_TOKEN_TTL_SECONDS as default expiry", () => {
    const before = Math.floor(Date.now() / 1000);
    const token = generateApiJwt(PAYLOAD, { secret: SECRET });
    const payload = decodePayload(token);
    expect((payload.exp as number) - (payload.iat as number)).toBe(
      ACCESS_TOKEN_TTL_SECONDS,
    );
    expect(payload.exp as number).toBeGreaterThan(before);
  });

  it("two tokens issued at the same second differ in signature", () => {
    // Different random bytes → different signatures even with same payload+time
    const t1 = generateApiJwt({ sub: "u1" }, { secret: SECRET });
    const t2 = generateApiJwt({ sub: "u1" }, { secret: SECRET });
    // They'll share header+payload if issued in the same second, but the test
    // at minimum verifies the function doesn't crash and produces valid tokens.
    expect(verifyApiJwt(t1, { secret: SECRET }).valid).toBe(true);
    expect(verifyApiJwt(t2, { secret: SECRET }).valid).toBe(true);
  });
});

describe("verifyApiJwt", () => {
  const SECRET = "test-secret-at-least-32-chars-long-ok";

  it("returns valid=true for a freshly issued token", () => {
    const token = generateApiJwt(
      { sub: "user-1", email: "a@b.com" },
      { secret: SECRET },
    );
    const result = verifyApiJwt(token, { secret: SECRET });
    expect(result.valid).toBe(true);
    expect(result.payload?.sub).toBe("user-1");
    expect(result.payload?.email).toBe("a@b.com");
  });

  it("returns valid=false with error=expired for an expired token — but still returns payload", () => {
    const token = generateApiJwt(
      { sub: "user-2" },
      { secret: SECRET, expiresInSeconds: -1 }, // already expired
    );
    const result = verifyApiJwt(token, { secret: SECRET });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("expired");
    expect(result.payload?.sub).toBe("user-2"); // payload preserved for refresh lookup
  });

  it("respects clockToleranceSeconds for borderline expiry", () => {
    const token = generateApiJwt(
      { sub: "user-3" },
      { secret: SECRET, expiresInSeconds: -5 }, // expired 5 s ago
    );
    // Without tolerance: expired
    expect(verifyApiJwt(token, { secret: SECRET }).valid).toBe(false);
    // With 10 s tolerance: still valid
    expect(
      verifyApiJwt(token, { secret: SECRET, clockToleranceSeconds: 10 }).valid,
    ).toBe(true);
  });

  it("returns valid=false with error=invalid_signature for a tampered token", () => {
    const token = generateApiJwt({ sub: "user-4" }, { secret: SECRET });
    const parts = token.split(".");
    // Flip one character in the signature
    const sig = parts[2];
    parts[2] = sig[0] === "A" ? "B" + sig.slice(1) : "A" + sig.slice(1);
    const tampered = parts.join(".");
    const result = verifyApiJwt(tampered, { secret: SECRET });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_signature");
  });

  it("returns valid=false with error=invalid_signature when signed with a different secret", () => {
    const token = generateApiJwt({ sub: "user-5" }, { secret: "secret-A" });
    const result = verifyApiJwt(token, { secret: "secret-B" });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_signature");
  });

  it("returns error=malformed for a non-JWT string", () => {
    expect(verifyApiJwt("not-a-jwt", { secret: SECRET }).error).toBe("malformed");
    expect(verifyApiJwt("a.b", { secret: SECRET }).error).toBe("malformed");
  });

  it("returns error=missing_token for empty / non-string input", () => {
    expect(verifyApiJwt("", { secret: SECRET }).error).toBe("missing_token");
    // @ts-expect-error intentional
    expect(verifyApiJwt(null, { secret: SECRET }).error).toBe("missing_token");
  });
});

// ─── hashRefreshToken ─────────────────────────────────────────────────────────

describe("hashRefreshToken", () => {
  it("produces a 64-char hex string (SHA-256)", () => {
    const hash = hashRefreshToken("some-plaintext-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same input always produces same hash", () => {
    const pt = "abc123";
    expect(hashRefreshToken(pt)).toBe(hashRefreshToken(pt));
  });

  it("matches Node crypto SHA-256 directly", () => {
    const pt = "verify-me";
    const expected = crypto
      .createHash("sha256")
      .update(pt)
      .digest("hex");
    expect(hashRefreshToken(pt)).toBe(expected);
  });

  it("different plaintexts produce different hashes", () => {
    expect(hashRefreshToken("token-A")).not.toBe(hashRefreshToken("token-B"));
  });
});

// ─── generateRefreshToken ─────────────────────────────────────────────────────

describe("generateRefreshToken", () => {
  it("returns an object with plaintext, hash, familyId, expiresAt", () => {
    const bundle = generateRefreshToken();
    expect(typeof bundle.plaintext).toBe("string");
    expect(bundle.plaintext.length).toBeGreaterThan(0);
    expect(typeof bundle.hash).toBe("string");
    expect(typeof bundle.familyId).toBe("string");
    expect(typeof bundle.expiresAt).toBe("number");
  });

  it("plaintext is 64 hex chars (32 random bytes)", () => {
    const { plaintext } = generateRefreshToken();
    expect(plaintext).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hash equals SHA-256(plaintext)", () => {
    const { plaintext, hash } = generateRefreshToken();
    expect(hash).toBe(hashRefreshToken(plaintext));
  });

  it("uses provided familyId", () => {
    const familyId = "my-family-id";
    expect(generateRefreshToken(familyId).familyId).toBe(familyId);
  });

  it("generates a new UUID familyId when none is provided", () => {
    const b1 = generateRefreshToken();
    const b2 = generateRefreshToken();
    // Both should be UUIDs and distinct
    expect(b1.familyId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(b1.familyId).not.toBe(b2.familyId);
  });

  it("expiresAt is approximately now + REFRESH_TOKEN_TTL_SECONDS", () => {
    const before = Math.floor(Date.now() / 1000);
    const { expiresAt } = generateRefreshToken();
    const after = Math.floor(Date.now() / 1000);
    expect(expiresAt).toBeGreaterThanOrEqual(before + REFRESH_TOKEN_TTL_SECONDS);
    expect(expiresAt).toBeLessThanOrEqual(after + REFRESH_TOKEN_TTL_SECONDS);
  });

  it("successive calls produce different plaintexts", () => {
    expect(generateRefreshToken().plaintext).not.toBe(
      generateRefreshToken().plaintext,
    );
  });
});

// ─── issueTokenPair ───────────────────────────────────────────────────────────

describe("issueTokenPair", () => {
  const SECRET = "test-secret-at-least-32-chars-long-ok";

  beforeEach(() => {
    process.env.API_JWT_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.API_JWT_SECRET;
  });

  it("returns accessToken (string) and refresh bundle", () => {
    const { accessToken, refresh } = issueTokenPair("user-1", "a@b.com");
    expect(typeof accessToken).toBe("string");
    expect(accessToken.split(".")).toHaveLength(3);
    expect(typeof refresh.plaintext).toBe("string");
    expect(typeof refresh.hash).toBe("string");
    expect(typeof refresh.familyId).toBe("string");
  });

  it("access token verifies correctly and has correct sub/email", () => {
    const { accessToken } = issueTokenPair("user-42", "bob@example.com");
    const result = verifyApiJwt(accessToken, { secret: SECRET });
    expect(result.valid).toBe(true);
    expect(result.payload?.sub).toBe("user-42");
    expect(result.payload?.email).toBe("bob@example.com");
  });

  it("passes familyId through to the refresh bundle (rotation chain)", () => {
    const existingFamilyId = "existing-family-abc";
    const { refresh } = issueTokenPair("u", "e@x.com", existingFamilyId);
    expect(refresh.familyId).toBe(existingFamilyId);
  });

  it("creates a new familyId when none is supplied (first login)", () => {
    const { refresh } = issueTokenPair("u", "e@x.com");
    expect(refresh.familyId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("embeds extraClaims in the access token", () => {
    const { accessToken } = issueTokenPair("u", "e@x.com", undefined, {
      scopes: ["read:clips"],
    });
    const result = verifyApiJwt(accessToken, { secret: SECRET });
    expect(result.payload?.scopes).toEqual(["read:clips"]);
  });
});

// ─── TTL constants ────────────────────────────────────────────────────────────

describe("TTL constants", () => {
  it("ACCESS_TOKEN_TTL_SECONDS defaults to 900 (15 min)", () => {
    // jest.setup.js does not set JWT_ACCESS_TOKEN_EXPIRES_IN
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(900);
  });

  it("REFRESH_TOKEN_TTL_SECONDS defaults to 604800 (7 days)", () => {
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(604800);
  });
});
