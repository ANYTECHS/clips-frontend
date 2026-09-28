/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET as keysGET, POST as keysPOST } from "@/app/api/keys/route";
import {
  GET as keyItemGET,
  PATCH as keyItemPATCH,
  DELETE as keyItemDELETE,
} from "@/app/api/keys/[id]/route";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn(),
  authOptions: {},
}));

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
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

const mockAuth = auth as jest.Mock;

describe("API Keys Management API (Issue #1164)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/keys", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/keys");
      const res = await keysGET(req);
      expect(res.status).toBe(401);
    });

    it("returns 200 with masked keys list when authenticated", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-123" } });
      const mockKeys = [
        {
          id: "key-1",
          name: "Production Key",
          keyPrefix: "ck_live_12345678",
          scopes: ["read", "write"],
          active: true,
          _count: { usages: 5 },
        },
      ];

      (prisma.apiKey.findMany as jest.Mock).mockResolvedValue(mockKeys);

      const req = new NextRequest("http://localhost/api/keys");
      const res = await keysGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.apiKeys.length).toBe(1);
      expect(json.apiKeys[0].keyPrefix).toBe("ck_live_12345678");
      // Raw key must never be exposed in list responses
      expect(json.apiKeys[0].key).toBeUndefined();
    });
  });

  describe("POST /api/keys", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/keys", {
        method: "POST",
        body: JSON.stringify({ name: "New Key" }),
      });
      const res = await keysPOST(req);
      expect(res.status).toBe(401);
    });

    it("creates an API key, records audit event, and returns raw key once", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-123" } });
      (prisma.apiKey.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({
          id: "new-key-id",
          name: data.name,
          keyPrefix: data.keyPrefix,
          scopes: data.scopes,
          active: true,
          createdAt: new Date(),
        })
      );

      const req = new NextRequest("http://localhost/api/keys", {
        method: "POST",
        body: JSON.stringify({ name: "CLI Access", scopes: ["read"] }),
      });
      const res = await keysPOST(req);

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.apiKey.id).toBe("new-key-id");
      expect(json.apiKey.key).toBeDefined(); // Raw key returned ONCE upon creation
      expect(json.apiKey.key.startsWith("ck_live_")).toBe(true);

      // Verify audit event was created
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: "user-123",
            action: "api_key.create",
            resource: "api_key",
          }),
        })
      );
    });
  });

  describe("DELETE /api/keys/[id]", () => {
    it("deletes the key and logs an audit event", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-123" } });
      (prisma.apiKey.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      const req = new NextRequest("http://localhost/api/keys/key-to-delete");
      const res = await keyItemDELETE(req, {
        params: Promise.resolve({ id: "key-to-delete" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: "user-123",
            action: "api_key.delete",
            resourceId: "key-to-delete",
          }),
        })
      );
    });
  });
});
