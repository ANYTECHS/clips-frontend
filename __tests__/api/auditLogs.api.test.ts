/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET as auditLogsGET } from "@/app/api/audit-logs/route";
import { GET as verifyGET } from "@/app/api/audit-logs/verify/route";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";

jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn(),
  authOptions: {},
}));

jest.mock("@/app/api/lib/apiAuth", () => ({
  authenticateApiKey: jest.fn().mockResolvedValue({ success: false }),
}));

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("@/app/lib/auditLog", () => ({
  verifyAuditLogIntegrity: jest.fn().mockResolvedValue({ verified: true, totalChecked: 5 }),
}));

const mockAuth = auth as jest.Mock;

function makeRequest(url = "http://localhost/api/audit-logs") {
  return new NextRequest(url);
}

describe("Audit Logs API (Issue #1162)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/audit-logs", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await auditLogsGET(makeRequest());
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("returns 200 with paginated logs when authenticated via session", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-123" } });
      const mockRecords = [
        {
          id: "log-1",
          timestamp: new Date().toISOString(),
          actorId: "user-123",
          actorType: "user",
          action: "auth.login",
          resource: "session",
          status: "success",
          eventHash: "hash-1",
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockRecords);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);

      const res = await auditLogsGET(makeRequest("http://localhost/api/audit-logs?page=1&limit=10"));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.length).toBe(1);
      expect(json.pagination.total).toBe(1);
      expect(json.pagination.page).toBe(1);
    });

    it("passes filter criteria to database query", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-123" } });
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await auditLogsGET(makeRequest("http://localhost/api/audit-logs?action=login&status=success"));

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: { contains: "login", mode: "insensitive" },
            status: "success",
          }),
        })
      );
    });
  });

  describe("GET /api/audit-logs/verify", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await verifyGET(makeRequest("http://localhost/api/audit-logs/verify"));
      expect(res.status).toBe(401);
    });

    it("returns 200 with verification result when authenticated", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-123" } });
      const res = await verifyGET(makeRequest("http://localhost/api/audit-logs/verify"));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.verified).toBe(true);
      expect(json.totalChecked).toBe(5);
    });
  });
});
