import {
  generateApiKey,
  hashApiKey,
  validateApiKey,
  checkApiKeyScope,
  revokeApiKey,
} from "@/app/lib/apiKey";
import { prisma } from "@/app/lib/prisma";

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

describe("API Key Management (Issue #1164)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      expect(checkApiKeyScope(["read"], "delete")).toBe(false);
    });

    it("allows access with wildcard * or admin scope", () => {
      expect(checkApiKeyScope(["*"], "delete")).toBe(true);
      expect(checkApiKeyScope(["admin"], "anything")).toBe(true);
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
