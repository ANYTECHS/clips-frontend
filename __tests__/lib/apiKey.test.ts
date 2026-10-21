/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import {
  generateApiKey,
  hashApiKey,
  validateApiKey,
  checkApiKeyScope,
  revokeApiKey,
  requireScope,
  getApiKeyQuotaWindow,
} from "@/app/lib/apiKey";
import { prisma } from "@/app/lib/prisma";
import { applyRateLimit } from "@/app/lib/serverRateLimit";

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    apiUsage: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/app/lib/serverRateLimit", () => ({
  applyRateLimit: jest.fn(),
}));

describe("API Key Management (Issue #1164)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (applyRateLimit as jest.Mock).mockResolvedValue(null);
    (prisma.apiUsage.create as jest.Mock).mockResolvedValue({});
  });

  describe("generateApiKey & hashApiKey", () => {
    it("generates a key with valid prefix and SHA-256 hash", () => {
      const generated = generateApiKey("ck_live");
      expect(generated.key.startsWith("ck_live_")).toBe(true);
      expect(generated.keyPrefix).toBe(generated.key.slice(0, 16));
      expect(generated.keyHash).toBe(hashApiKey(generated.key));
      expect(generated.keyHash.length).toBe(64); // SHA-256 hex length
    });

    it("produces deterministic SHA-256 hashes", () => {
      const hash1 = hashApiKey("ck_live_1234567890abcdef");
      const hash2 = hashApiKey("ck_live_1234567890abcdef");
      expect(hash1).toBe(hash2);
    });
  });

  describe("validateApiKey", () => {
    it("returns error for missing key", async () => {
      const result = await validateApiKey("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("missing_key");
    });

    it("returns error for invalid key format", async () => {
      const result = await validateApiKey("invalid_prefix_12345");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_format");
    });

    it("validates an active, non-expired key successfully", async () => {
      const key = "ck_live_abcdef1234567890abcdef1234567890";
      const keyHash = hashApiKey(key);

      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({
        id: "key-1",
        userId: "user-1",
        name: "Test Key",
        keyPrefix: key.slice(0, 16),
        scopes: ["read", "write"],
        active: true,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
        user: { id: "user-1", email: "user@test.com", plan: "pro" },
      });
      (prisma.apiKey.update as jest.Mock).mockResolvedValue({});

      const result = await validateApiKey(key);
      expect(result.valid).toBe(true);
      expect(result.apiKey?.id).toBe("key-1");
      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { keyHash },
        include: { user: { select: { id: true, email: true, name: true, plan: true } } },
      });
    });

    it("rejects an inactive API key", async () => {
      const key = "ck_live_inactive1234567890";
      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({
        id: "key-2",
        active: false,
        revokedAt: null,
        expiresAt: null,
      });

      const result = await validateApiKey(key);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("inactive");
    });

    it("rejects a revoked API key", async () => {
      const key = "ck_live_revoked1234567890";
      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({
        id: "key-3",
        active: true,
        revokedAt: new Date(),
        expiresAt: null,
      });

      const result = await validateApiKey(key);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("revoked");
    });

    it("rejects an expired API key", async () => {
      const key = "ck_live_expired1234567890";
      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({
        id: "key-4",
        active: true,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 10000), // In the past
      });

      const result = await validateApiKey(key);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("expired");
    });
  });

  describe("checkApiKeyScope", () => {
    it("allows access when scope matches", () => {
      expect(checkApiKeyScope(["read", "write"], "read")).toBe(true);
      expect(checkApiKeyScope(["read", "write"], "write")).toBe(true);
      expect(checkApiKeyScope(["read"], "clips:read")).toBe(true);
      expect(checkApiKeyScope(["read"], "clips:write")).toBe(false);
      expect(checkApiKeyScope(["read"], "delete")).toBe(false);
    });

    it("allows access with wildcard * or admin scope", () => {
      expect(checkApiKeyScope(["*"], "delete")).toBe(true);
      expect(checkApiKeyScope(["admin"], "anything")).toBe(true);
    });
  });

  describe("requireScope", () => {
    const rawKey = "ck_live_scoped1234567890abcdef1234567890";

    beforeEach(() => {
      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({
        id: "key-scoped",
        userId: "user-1",
        name: "Scoped key",
        keyPrefix: rawKey.slice(0, 16),
        scopes: ["read"],
        active: true,
        revokedAt: null,
        expiresAt: null,
        user: { id: "user-1", email: "user@test.com", plan: "pro" },
      });
      (prisma.apiKey.update as jest.Mock).mockResolvedValue({});
    });

    it("returns the required scope in a 403 response and records usage", async () => {
      const handler = jest.fn();
      const route = requireScope("write")(handler);
      const request = new NextRequest("http://localhost/api/v1/upload", {
        method: "POST",
        headers: { "x-api-key": rawKey },
      });

      const response = await route(request);

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "Insufficient scope", required: "write" });
      expect(handler).not.toHaveBeenCalled();
      expect(prisma.apiUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          apiKeyId: "key-scoped",
          endpoint: "/api/v1/upload",
          method: "POST",
          statusCode: 403,
          responseTime: expect.any(Number),
        }),
      });
    });

    it("does not wait for the usage write before returning a successful response", async () => {
      (prisma.apiKey.findUnique as jest.Mock).mockImplementation(async () => ({
        id: "key-scoped",
        userId: "user-1",
        scopes: ["write"],
        active: true,
        revokedAt: null,
        expiresAt: null,
      }));
      (prisma.apiUsage.create as jest.Mock).mockReturnValue(new Promise(() => {}));
      const handler = jest
        .fn()
        .mockResolvedValue(NextResponse.json({ success: true }, { status: 201 }));
      const route = requireScope("write")(handler);
      const request = new NextRequest("http://localhost/api/v1/upload", {
        method: "POST",
        headers: { "x-api-key": rawKey },
      });

      const response = await route(request);

      expect(response.status).toBe(201);
      expect(prisma.apiUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          apiKeyId: "key-scoped",
          endpoint: "/api/v1/upload",
          method: "POST",
          statusCode: 201,
          responseTime: expect.any(Number),
        }),
      });
    });

    it("returns 429 with Retry-After when the key exceeds its quota", async () => {
      (prisma.apiKey.findUnique as jest.Mock).mockImplementation(async () => ({
        id: "key-scoped",
        userId: "user-1",
        scopes: ["write"],
        active: true,
        revokedAt: null,
        expiresAt: null,
      }));
      (applyRateLimit as jest.Mock).mockResolvedValue(
        NextResponse.json(
          { error: "Too many requests" },
          {
            status: 429,
            headers: { "Retry-After": "60" },
          }
        )
      );
      const handler = jest.fn();
      const route = requireScope("write")(handler);
      const request = new NextRequest("http://localhost/api/v1/upload", {
        method: "POST",
        headers: { "x-api-key": rawKey },
      });

      const response = await route(request);

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("60");
      expect(handler).not.toHaveBeenCalled();
      expect(prisma.apiUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ apiKeyId: "key-scoped", statusCode: 429 }),
      });
    });

    it("rotates quota windows at the configured reset boundary", () => {
      const previousWindow = process.env.API_KEY_QUOTA_WINDOW_MS;
      process.env.API_KEY_QUOTA_WINDOW_MS = "60000";

      expect(getApiKeyQuotaWindow(119999)).toEqual({ startAt: 60000, endsAt: 120000 });
      expect(getApiKeyQuotaWindow(120000)).toEqual({ startAt: 120000, endsAt: 180000 });

      if (previousWindow === undefined) delete process.env.API_KEY_QUOTA_WINDOW_MS;
      else process.env.API_KEY_QUOTA_WINDOW_MS = previousWindow;
    });
  });

  describe("revokeApiKey", () => {
    it("revokes an active API key", async () => {
      (prisma.apiKey.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      const success = await revokeApiKey("key-1", "user-1");
      expect(success).toBe(true);
      expect(prisma.apiKey.updateMany).toHaveBeenCalledWith({
        where: { id: "key-1", userId: "user-1", revokedAt: null },
        data: { active: false, revokedAt: expect.any(Date) },
      });
    });
  });
});
