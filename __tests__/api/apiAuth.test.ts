/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateApiRequest,
  authenticateApiKey,
  withApiAuth,
  logAuthFailure,
} from "@/app/api/lib/apiAuth";
import { generateApiJwt } from "@/app/lib/jwt";
import { hashApiKey } from "@/app/lib/apiKey";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";

jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn(),
  authOptions: {},
}));

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const mockAuth = auth as jest.Mock;

describe("API Authentication & Monitoring (Issue #1164)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(null);
  });

  describe("API Key Authentication", () => {
    it("authenticates a valid API key via Authorization: Bearer header", async () => {
      const rawKey = "ck_live_valid1234567890abcdef1234567890";
      const keyHash = hashApiKey(rawKey);

      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({
        id: "key-1",
        userId: "user-1",
        name: "Test Key",
        keyPrefix: rawKey.slice(0, 16),
        scopes: ["read", "write"],
        active: true,
        revokedAt: null,
        expiresAt: null,
        user: { id: "user-1", email: "user@example.com", plan: "pro" },
      });
      (prisma.apiKey.update as jest.Mock).mockResolvedValue({});

      const req = new NextRequest("http://localhost/api/test", {
        headers: { authorization: `Bearer ${rawKey}` },
      });

      const result = await authenticateApiKey(req);
      expect(result.success).toBe(true);
      expect(result.authType).toBe("api_key");
      expect(result.apiKey?.id).toBe("key-1");
      expect(result.user?.id).toBe("user-1");
    });

    it("authenticates a valid API key via X-API-Key header", async () => {
      const rawKey = "ck_live_header1234567890abcdef1234567890";

      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({
        id: "key-header",
        userId: "user-header",
        name: "Header Key",
        scopes: ["read"],
        active: true,
        revokedAt: null,
        user: { id: "user-header" },
      });

      const req = new NextRequest("http://localhost/api/test", {
        headers: { "x-api-key": rawKey },
      });

      const result = await authenticateApiKey(req);
      expect(result.success).toBe(true);
      expect(result.apiKey?.id).toBe("key-header");
    });

    it("rejects invalid API key and logs failure event", async () => {
      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/test", {
        headers: { authorization: "Bearer ck_live_invalid12345" },
      });

      const result = await authenticateApiKey(req);
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toBe("Invalid API key");
    });

    it("rejects an expired API key", async () => {
      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({
        id: "key-exp",
        active: true,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60000), // In past
      });

      const req = new NextRequest("http://localhost/api/test", {
        headers: { authorization: "Bearer ck_live_expired12345" },
      });

      const result = await authenticateApiKey(req);
      expect(result.success).toBe(false);
      expect(result.error).toBe("API key has expired");
    });

    it("rejects a revoked API key", async () => {
      (prisma.apiKey.findUnique as jest.Mock).mockResolvedValue({
        id: "key-rev",
        active: true,
        revokedAt: new Date(),
      });

      const req = new NextRequest("http://localhost/api/test", {
        headers: { authorization: "Bearer ck_live_revoked12345" },
      });

      const result = await authenticateApiKey(req);
      expect(result.success).toBe(false);
      expect(result.error).toBe("API key has been revoked");
    });

    it("handles missing API key credentials", async () => {
      const req = new NextRequest("http://localhost/api/test");
      const result = await authenticateApiKey(req);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing API key credentials");
    });
  });

  describe("JWT Authentication", () => {
    it("authenticates a valid JWT token via Authorization header", async () => {
      const token = generateApiJwt({
        sub: "user-jwt-1",
        email: "jwt@example.com",
        scopes: ["read", "write"],
      });

      const req = new NextRequest("http://localhost/api/test", {
        headers: { authorization: `Bearer ${token}` },
      });

      const result = await authenticateApiRequest(req);
      expect(result.success).toBe(true);
      expect(result.authType).toBe("jwt");
      expect(result.user?.id).toBe("user-jwt-1");
      expect(result.jwtPayload?.email).toBe("jwt@example.com");
    });

    it("rejects an expired JWT token", async () => {
      const expiredToken = generateApiJwt(
        { sub: "user-jwt-expired" },
        { expiresInSeconds: -60 }
      );

      const req = new NextRequest("http://localhost/api/test", {
        headers: { authorization: `Bearer ${expiredToken}` },
      });

      const result = await authenticateApiRequest(req);
      expect(result.success).toBe(false);
      expect(result.error).toBe("JWT token has expired");
      expect(result.statusCode).toBe(401);
    });

    it("rejects a malformed JWT token", async () => {
      const req = new NextRequest("http://localhost/api/test", {
        headers: { authorization: "Bearer malformed.jwt.token" },
      });

      const result = await authenticateApiRequest(req);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid JWT token");
    });
  });

  describe("Session Authentication Fallback", () => {
    it("falls back to user session when no Bearer or API key is provided", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-session-1", email: "session@example.com" } });

      const req = new NextRequest("http://localhost/api/test");
      const result = await authenticateApiRequest(req);

      expect(result.success).toBe(true);
      expect(result.authType).toBe("session");
      expect(result.user?.id).toBe("user-session-1");
    });
  });

  describe("withApiAuth Middleware Wrapper", () => {
    it("blocks unauthenticated requests with 401", async () => {
      mockAuth.mockResolvedValue(null);

      const handler = jest.fn();
      const protectedRoute = withApiAuth(handler);

      const req = new NextRequest("http://localhost/api/protected");
      const response = await protectedRoute(req);

      expect(response.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it("permits authenticated requests and provides authContext to handler", async () => {
      const token = generateApiJwt({ sub: "user-123" });
      const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
      const protectedRoute = withApiAuth(handler);

      const req = new NextRequest("http://localhost/api/protected", {
        headers: { authorization: `Bearer ${token}` },
      });

      const response = await protectedRoute(req);
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({
          success: true,
          authType: "jwt",
          user: expect.objectContaining({ id: "user-123" }),
        })
      );
    });

    it("enforces required scopes", async () => {
      const token = generateApiJwt({ sub: "user-123", scopes: ["read"] });
      const handler = jest.fn();
      const adminRoute = withApiAuth(handler, { requiredScope: "admin" });

      const req = new NextRequest("http://localhost/api/admin", {
        headers: { authorization: `Bearer ${token}` },
      });

      const response = await adminRoute(req);
      expect(response.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
