/**
 * @jest-environment node
 *
 * Unit tests for POST /api/auth/refresh and app/lib/tokenDenylist.ts
 *
 * Coverage:
 *   Refresh endpoint:
 *     - 401 when no cookie
 *     - 401 for unknown token hash
 *     - 401 for expired token
 *     - 401 + family revocation on reuse detection (revokedAt set)
 *     - 401 + family revocation on reuse detection (Redis denylisted)
 *     - 200 happy path: new accessToken in body, Set-Cookie header
 *     - 500 when denylistToken DB write fails
 *
 *   tokenDenylist module:
 *     - denylistKey / familyKey format
 *     - denylistToken: updates DB, writes Redis key
 *     - revokeFamilyTokens: bulk-revokes DB rows, writes Redis family key
 *     - isTokenDenylisted: Redis hit → true; Redis miss + DB revokedAt → true; not revoked → false
 *     - isFamilyRevoked: Redis hit → true; no active DB rows → true; active row → false
 *     - storeRefreshToken: creates DB row with correct fields
 *     - pruneExpiredRefreshTokens: deletes expired rows, returns count
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/refresh/route";
import {
  denylistKey,
  familyKey,
  denylistToken,
  revokeFamilyTokens,
  isTokenDenylisted,
  isFamilyRevoked,
  storeRefreshToken,
  pruneExpiredRefreshTokens,
} from "@/app/lib/tokenDenylist";
import { hashRefreshToken } from "@/app/lib/jwt";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    refreshToken: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("@/app/api/jobs/shared/redisClient", () => ({
  getRedisClient: jest.fn(),
  isRedisAvailable: jest.fn(),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// tokenDenylist imports REFRESH_TOKEN_TTL_SECONDS from jwt — keep real value
// but mock away Redis by default in each test.

import { prisma } from "@/app/lib/prisma";
import { getRedisClient, isRedisAvailable } from "@/app/api/jobs/shared/redisClient";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRefreshToken = prisma.refreshToken as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAuditLog = prisma.auditLog as any;
const mockGetRedis = getRedisClient as jest.Mock;
const mockIsRedisAvailable = isRedisAvailable as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a minimal NextRequest with an optional rt cookie. */
function makeRefreshRequest(refreshTokenPlaintext?: string): NextRequest {
  const url = "http://localhost/api/auth/refresh";
  const headers: Record<string, string> = {};
  if (refreshTokenPlaintext) {
    headers["cookie"] = `rt=${refreshTokenPlaintext}`;
  }
  return new NextRequest(url, { method: "POST", headers });
}

function futureDate(offsetSeconds: number): Date {
  return new Date(Date.now() + offsetSeconds * 1000);
}

function pastDate(offsetSeconds: number): Date {
  return new Date(Date.now() - offsetSeconds * 1000);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default: Redis unavailable (forces DB path)
  mockIsRedisAvailable.mockReturnValue(false);
  mockGetRedis.mockReturnValue(null);

  // Default audit log chain
  mockAuditLog.findFirst.mockResolvedValue(null);
  mockAuditLog.create.mockResolvedValue({ id: "audit-1", eventHash: "hash" });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/auth/refresh", () => {
  const PLAINTEXT = "a".repeat(64); // 64-char hex-like string
  const TOKEN_HASH = hashRefreshToken(PLAINTEXT);
  const USER_ID = "user-abc";
  const FAMILY_ID = "family-xyz";
  const EMAIL = "alice@example.com";

  const validStoredToken = {
    id: "rt-row-1",
    userId: USER_ID,
    familyId: FAMILY_ID,
    expiresAt: futureDate(604800),
    revokedAt: null,
    user: { email: EMAIL },
  };

  it("returns 401 when no rt cookie is present", async () => {
    const req = makeRefreshRequest(); // no cookie
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/no refresh token/i);
  });

  it("returns 401 when token hash is not found in DB", async () => {
    mockRefreshToken.findUnique.mockResolvedValue(null);
    const req = makeRefreshRequest(PLAINTEXT);
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/invalid refresh token/i);
  });

  it("returns 401 when token is expired", async () => {
    mockRefreshToken.findUnique.mockResolvedValue({
      ...validStoredToken,
      expiresAt: pastDate(100), // expired 100 s ago
    });
    const req = makeRefreshRequest(PLAINTEXT);
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/expired/i);
  });

  describe("reuse detection", () => {
    it("returns 401 and revokes family when revokedAt is already set (DB-level reuse)", async () => {
      mockRefreshToken.findUnique.mockResolvedValue({
        ...validStoredToken,
        revokedAt: pastDate(60), // was already revoked 60 s ago
      });
      // isTokenDenylisted falls through to DB — returns revokedAt non-null
      mockRefreshToken.findUnique
        .mockResolvedValueOnce({
          ...validStoredToken,
          revokedAt: pastDate(60),
        }) // route's own findUnique
        .mockResolvedValueOnce({ revokedAt: pastDate(60) }); // isTokenDenylisted DB path

      mockRefreshToken.updateMany.mockResolvedValue({ count: 1 });

      const req = makeRefreshRequest(PLAINTEXT);
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/reuse detected/i);

      // Family must be revoked
      expect(mockRefreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ familyId: FAMILY_ID }),
          data: { revokedAt: expect.any(Date) },
        }),
      );

      // Cookie cleared
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toContain("Max-Age=0");
    });

    it("returns 401 and revokes family when Redis marks token as denylisted", async () => {
      mockRefreshToken.findUnique.mockResolvedValue(validStoredToken);

      // Make Redis available and return a hit for the denylistKey
      mockIsRedisAvailable.mockReturnValue(true);
      const mockRedis = { get: jest.fn().mockResolvedValue("1"), set: jest.fn().mockResolvedValue("OK") };
      mockGetRedis.mockReturnValue(mockRedis);

      mockRefreshToken.updateMany.mockResolvedValue({ count: 2 });

      const req = makeRefreshRequest(PLAINTEXT);
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/reuse detected/i);
    });
  });

  describe("happy path — normal rotation", () => {
    beforeEach(() => {
      mockRefreshToken.findUnique.mockImplementation(({ where }) => {
        // First call: route lookup (returns full row)
        // Second call: isTokenDenylisted DB path (returns not revoked)
        if (where?.tokenHash === TOKEN_HASH) {
          return Promise.resolve(validStoredToken);
        }
        return Promise.resolve({ revokedAt: null });
      });

      // isTokenDenylisted → DB path → not revoked
      // Override to handle multiple calls correctly
      mockRefreshToken.findUnique
        .mockResolvedValueOnce(validStoredToken)         // route findUnique
        .mockResolvedValueOnce({ revokedAt: null });     // isTokenDenylisted

      mockRefreshToken.updateMany.mockResolvedValue({ count: 1 }); // denylistToken
      mockRefreshToken.create.mockResolvedValue({ id: "rt-new" }); // storeRefreshToken
    });

    it("returns 200 with accessToken and expiresIn", async () => {
      const req = makeRefreshRequest(PLAINTEXT);
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(typeof json.accessToken).toBe("string");
      expect(json.accessToken.split(".")).toHaveLength(3); // valid JWT structure
      expect(typeof json.expiresIn).toBe("number");
      expect(json.expiresIn).toBe(900); // ACCESS_TOKEN_TTL_SECONDS
    });

    it("sets a new rt cookie in the response", async () => {
      const req = makeRefreshRequest(PLAINTEXT);
      const res = await POST(req);
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain("rt=");
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Strict");
      expect(setCookie).toContain("Path=/api/auth/refresh");
    });

    it("old token is denylisted before new token is stored", async () => {
      const callOrder: string[] = [];
      mockRefreshToken.updateMany.mockImplementation(() => {
        callOrder.push("denylist");
        return Promise.resolve({ count: 1 });
      });
      mockRefreshToken.create.mockImplementation(() => {
        callOrder.push("store");
        return Promise.resolve({ id: "rt-new" });
      });

      const req = makeRefreshRequest(PLAINTEXT);
      await POST(req);

      expect(callOrder).toEqual(["denylist", "store"]);
    });

    it("stores the new token with replacedByHash pointing to old hash", async () => {
      const req = makeRefreshRequest(PLAINTEXT);
      await POST(req);

      expect(mockRefreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            familyId: FAMILY_ID,
            replacedByHash: TOKEN_HASH,
            userId: USER_ID,
          }),
        }),
      );
    });

    it("new token preserves the same familyId", async () => {
      const req = makeRefreshRequest(PLAINTEXT);
      await POST(req);

      const createCall = mockRefreshToken.create.mock.calls[0][0];
      expect(createCall.data.familyId).toBe(FAMILY_ID);
    });
  });

  it("returns 500 when denylistToken DB write throws", async () => {
    mockRefreshToken.findUnique
      .mockResolvedValueOnce(validStoredToken)
      .mockResolvedValueOnce({ revokedAt: null });

    mockRefreshToken.updateMany.mockRejectedValue(new Error("DB error"));

    const req = makeRefreshRequest(PLAINTEXT);
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tokenDenylist module
// ─────────────────────────────────────────────────────────────────────────────

describe("denylistKey / familyKey", () => {
  it("denylistKey formats correctly", () => {
    expect(denylistKey("abc123")).toBe("rt:deny:abc123");
  });

  it("familyKey formats correctly", () => {
    expect(familyKey("fam-1")).toBe("rt:family:fam-1");
  });
});

describe("denylistToken", () => {
  const HASH = "deadbeef".repeat(8); // 64-char fake hash

  it("calls prisma.refreshToken.updateMany with revokedAt", async () => {
    mockRefreshToken.updateMany.mockResolvedValue({ count: 1 });

    await denylistToken(HASH);

    expect(mockRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: HASH, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("writes to Redis when Redis is available", async () => {
    mockRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    mockIsRedisAvailable.mockReturnValue(true);
    const mockRedis = { set: jest.fn().mockResolvedValue("OK") };
    mockGetRedis.mockReturnValue(mockRedis);

    await denylistToken(HASH, 3600);

    expect(mockRedis.set).toHaveBeenCalledWith(
      denylistKey(HASH),
      "1",
      "EX",
      3600,
    );
  });

  it("does not call Redis when Redis is unavailable", async () => {
    mockRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    mockIsRedisAvailable.mockReturnValue(false);

    await denylistToken(HASH);

    expect(mockGetRedis).not.toHaveBeenCalled();
  });

  it("re-throws when DB update fails (to block token issuance)", async () => {
    mockRefreshToken.updateMany.mockRejectedValue(new Error("DB down"));
    await expect(denylistToken(HASH)).rejects.toThrow("DB down");
  });
});

describe("revokeFamilyTokens", () => {
  const FAMILY = "family-001";

  it("bulk-revokes all family rows in DB and returns count", async () => {
    mockRefreshToken.updateMany.mockResolvedValue({ count: 3 });

    const count = await revokeFamilyTokens(FAMILY);

    expect(count).toBe(3);
    expect(mockRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: FAMILY, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("writes family key to Redis when available", async () => {
    mockRefreshToken.updateMany.mockResolvedValue({ count: 2 });
    mockIsRedisAvailable.mockReturnValue(true);
    const mockRedis = { set: jest.fn().mockResolvedValue("OK") };
    mockGetRedis.mockReturnValue(mockRedis);

    await revokeFamilyTokens(FAMILY);

    expect(mockRedis.set).toHaveBeenCalledWith(
      familyKey(FAMILY),
      "revoked",
      "EX",
      expect.any(Number),
    );
  });
});

describe("isTokenDenylisted", () => {
  const HASH = "cafebabe".repeat(8);

  it("returns true immediately when Redis has the denylist key", async () => {
    mockIsRedisAvailable.mockReturnValue(true);
    const mockRedis = { get: jest.fn().mockResolvedValue("1") };
    mockGetRedis.mockReturnValue(mockRedis);

    const result = await isTokenDenylisted(HASH);

    expect(result).toBe(true);
    // DB should not be consulted — Redis short-circuits
    expect(mockRefreshToken.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to DB and returns true when revokedAt is set", async () => {
    mockIsRedisAvailable.mockReturnValue(false);
    mockRefreshToken.findUnique.mockResolvedValue({ revokedAt: new Date() });

    expect(await isTokenDenylisted(HASH)).toBe(true);
  });

  it("returns false when DB row has revokedAt=null (token is active)", async () => {
    mockIsRedisAvailable.mockReturnValue(false);
    mockRefreshToken.findUnique.mockResolvedValue({ revokedAt: null });

    expect(await isTokenDenylisted(HASH)).toBe(false);
  });

  it("fails secure — returns true when DB lookup throws", async () => {
    mockIsRedisAvailable.mockReturnValue(false);
    mockRefreshToken.findUnique.mockRejectedValue(new Error("DB timeout"));

    expect(await isTokenDenylisted(HASH)).toBe(true);
  });

  it("uses DB fallback when Redis GET throws", async () => {
    mockIsRedisAvailable.mockReturnValue(true);
    const mockRedis = { get: jest.fn().mockRejectedValue(new Error("Redis down")) };
    mockGetRedis.mockReturnValue(mockRedis);
    mockRefreshToken.findUnique.mockResolvedValue({ revokedAt: null });

    const result = await isTokenDenylisted(HASH);

    expect(result).toBe(false);
    expect(mockRefreshToken.findUnique).toHaveBeenCalled();
  });
});

describe("isFamilyRevoked", () => {
  const FAMILY = "family-check";

  it("returns true when Redis has the family key", async () => {
    mockIsRedisAvailable.mockReturnValue(true);
    const mockRedis = { get: jest.fn().mockResolvedValue("revoked") };
    mockGetRedis.mockReturnValue(mockRedis);

    expect(await isFamilyRevoked(FAMILY)).toBe(true);
    expect(mockRefreshToken.findFirst).not.toHaveBeenCalled();
  });

  it("returns true when DB has no active tokens in family", async () => {
    mockIsRedisAvailable.mockReturnValue(false);
    mockRefreshToken.findFirst.mockResolvedValue(null);

    expect(await isFamilyRevoked(FAMILY)).toBe(true);
  });

  it("returns false when DB has at least one active token", async () => {
    mockIsRedisAvailable.mockReturnValue(false);
    mockRefreshToken.findFirst.mockResolvedValue({ id: "rt-active" });

    expect(await isFamilyRevoked(FAMILY)).toBe(false);
  });
});

describe("storeRefreshToken", () => {
  it("calls prisma.refreshToken.create with correct fields", async () => {
    mockRefreshToken.create.mockResolvedValue({ id: "rt-new" });

    const expiresAt = Math.floor(Date.now() / 1000) + 604800;
    await storeRefreshToken({
      userId: "user-1",
      tokenHash: "newhash",
      familyId: "fam-1",
      expiresAt,
      replacedHash: "oldhash",
    });

    expect(mockRefreshToken.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        tokenHash: "newhash",
        familyId: "fam-1",
        expiresAt: new Date(expiresAt * 1000),
        replacedByHash: "oldhash",
      },
    });
  });

  it("stores null replacedByHash when not provided (first issuance)", async () => {
    mockRefreshToken.create.mockResolvedValue({ id: "rt-first" });

    await storeRefreshToken({
      userId: "u",
      tokenHash: "h",
      familyId: "f",
      expiresAt: Math.floor(Date.now() / 1000) + 100,
    });

    expect(mockRefreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ replacedByHash: null }),
      }),
    );
  });
});

describe("pruneExpiredRefreshTokens", () => {
  it("calls deleteMany with a cutoff date and returns count", async () => {
    mockRefreshToken.deleteMany.mockResolvedValue({ count: 7 });

    const count = await pruneExpiredRefreshTokens(2);

    expect(count).toBe(7);
    expect(mockRefreshToken.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lt: expect.any(Date) },
      },
    });
  });
});
