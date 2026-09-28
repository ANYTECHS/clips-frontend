/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET as sessionsGET, DELETE as sessionsDELETE } from "@/app/api/auth/sessions/route";
import { DELETE as sessionItemDELETE } from "@/app/api/auth/sessions/[id]/route";
import { auth } from "@/app/lib/auth";
import { getUserActiveSessions, revokeAllUserSessions } from "@/app/lib/sessionSecurity";
import { prisma } from "@/app/lib/prisma";

jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn(),
  authOptions: {},
}));

jest.mock("@/app/lib/sessionSecurity", () => ({
  getUserActiveSessions: jest.fn(),
  revokeAllUserSessions: jest.fn(),
}));

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    userSession: {
      updateMany: jest.fn(),
    },
    auditLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const mockAuth = auth as jest.Mock;

describe("Sessions API (Issue #1163)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/auth/sessions", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/auth/sessions");
      const res = await sessionsGET(req);
      expect(res.status).toBe(401);
    });

    it("returns 200 with active session list when authenticated", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-123" } });
      (getUserActiveSessions as jest.Mock).mockResolvedValue([
        { id: "sess-1", ipAddress: "127.0.0.1", isCurrent: true },
      ]);

      const req = new NextRequest("http://localhost/api/auth/sessions");
      const res = await sessionsGET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.sessions.length).toBe(1);
      expect(json.sessions[0].id).toBe("sess-1");
    });
  });

  describe("DELETE /api/auth/sessions", () => {
    it("revokes all other sessions", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-123" } });
      (revokeAllUserSessions as jest.Mock).mockResolvedValue(2);

      const req = new NextRequest("http://localhost/api/auth/sessions");
      const res = await sessionsDELETE(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.revokedCount).toBe(2);
    });
  });

  describe("DELETE /api/auth/sessions/[id]", () => {
    it("revokes a specific session", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-123" } });
      (prisma.userSession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const req = new NextRequest("http://localhost/api/auth/sessions/sess-target");
      const res = await sessionItemDELETE(req, {
        params: Promise.resolve({ id: "sess-target" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });
});
