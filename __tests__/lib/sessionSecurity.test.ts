import {
  getSessionSecurityConfig,
  getSecureCookieConfig,
  createTrackedSession,
  validateTrackedSession,
  rotateSession,
  revokeSession,
  revokeAllUserSessions,
  getUserActiveSessions,
} from "@/app/lib/sessionSecurity";
import { prisma } from "@/app/lib/prisma";

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    userSession: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe("Session Security (Issue #1163)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Cookie Flags Configuration", () => {
    it("configures HttpOnly, SameSite, and Secure flags in production", () => {
      const prodCookies = getSecureCookieConfig(true);
      expect(prodCookies.sessionToken.options.httpOnly).toBe(true);
      expect(prodCookies.sessionToken.options.secure).toBe(true);
      expect(prodCookies.sessionToken.options.sameSite).toBe("lax");
      expect(prodCookies.sessionToken.options.path).toBe("/");
      expect(prodCookies.sessionToken.name.startsWith("__Secure-")).toBe(true);
    });

    it("allows non-Secure cookies in local development for localhost compatibility", () => {
      const devCookies = getSecureCookieConfig(false);
      expect(devCookies.sessionToken.options.httpOnly).toBe(true);
      expect(devCookies.sessionToken.options.secure).toBe(false);
      expect(devCookies.sessionToken.options.sameSite).toBe("lax");
      expect(devCookies.sessionToken.name.startsWith("__Secure-")).toBe(false);
    });
  });

  describe("Session Lifetime & Configuration", () => {
    it("respects custom environment variable configuration", () => {
      process.env.SESSION_MAX_AGE = "7200";
      process.env.SESSION_INACTIVITY_TIMEOUT = "1800";
      process.env.MAX_CONCURRENT_SESSIONS = "3";

      const config = getSessionSecurityConfig();
      expect(config.sessionMaxAgeSeconds).toBe(7200);
      expect(config.inactivityTimeoutSeconds).toBe(1800);
      expect(config.maxConcurrentSessions).toBe(3);
    });
  });

  describe("Concurrent Session Limits", () => {
    it("revokes oldest session when user reaches maximum concurrent sessions", async () => {
      process.env.MAX_CONCURRENT_SESSIONS = "2";

      const existingSessions = [
        { id: "sess-oldest", createdAt: new Date(Date.now() - 300000) },
        { id: "sess-newer", createdAt: new Date(Date.now() - 100000) },
      ];

      (prisma.userSession.findMany as jest.Mock).mockResolvedValue(existingSessions);
      (prisma.userSession.update as jest.Mock).mockResolvedValue({});
      (prisma.userSession.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: "sess-new", ...data })
      );

      const session = await createTrackedSession("user-1");

      expect(session).toBeDefined();
      // Oldest session should be marked revoked
      expect(prisma.userSession.update).toHaveBeenCalledWith({
        where: { id: "sess-oldest" },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe("Session Validation & Inactivity Timeout", () => {
    it("validates an active session within timeout", async () => {
      (prisma.userSession.findUnique as jest.Mock).mockResolvedValue({
        id: "sess-1",
        userId: "user-1",
        sessionToken: "sess_valid",
        expiresAt: new Date(Date.now() + 100000),
        lastActivityAt: new Date(), // Active right now
        revokedAt: null,
      });
      (prisma.userSession.update as jest.Mock).mockResolvedValue({});

      const result = await validateTrackedSession("sess_valid");
      expect(result.valid).toBe(true);
      expect(result.session.id).toBe("sess-1");
    });

    it("rejects and revokes a session that exceeded inactivity timeout", async () => {
      process.env.SESSION_INACTIVITY_TIMEOUT = "3600"; // 1 hour

      (prisma.userSession.findUnique as jest.Mock).mockResolvedValue({
        id: "sess-inactive",
        userId: "user-1",
        sessionToken: "sess_inactive",
        expiresAt: new Date(Date.now() + 100000),
        lastActivityAt: new Date(Date.now() - 7200000), // 2 hours ago
        revokedAt: null,
      });
      (prisma.userSession.update as jest.Mock).mockResolvedValue({});

      const result = await validateTrackedSession("sess_inactive");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("inactivity_timeout");
      expect(prisma.userSession.update).toHaveBeenCalledWith({
        where: { id: "sess-inactive" },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("rejects an already revoked session", async () => {
      (prisma.userSession.findUnique as jest.Mock).mockResolvedValue({
        id: "sess-revoked",
        revokedAt: new Date(),
      });

      const result = await validateTrackedSession("sess_revoked");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("revoked");
    });

    it("rejects an expired session", async () => {
      (prisma.userSession.findUnique as jest.Mock).mockResolvedValue({
        id: "sess-expired",
        expiresAt: new Date(Date.now() - 5000),
        revokedAt: null,
      });

      const result = await validateTrackedSession("sess_expired");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("expired");
    });
  });

  describe("Session Rotation", () => {
    it("revokes old session and creates a new one upon rotation", async () => {
      (prisma.userSession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.userSession.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: "sess-rotated", ...data })
      );

      const rotated = await rotateSession("sess_old", "user-1");

      expect(rotated).toBeDefined();
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { sessionToken: "sess_old", userId: "user-1" },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.userSession.create).toHaveBeenCalled();
    });
  });

  describe("Session Revocation", () => {
    it("revokes a specific session", async () => {
      (prisma.userSession.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      const success = await revokeSession("sess-1", "user-1");
      expect(success).toBe(true);
    });

    it("revokes all user sessions except current", async () => {
      (prisma.userSession.updateMany as jest.Mock).mockResolvedValue({ count: 3 });
      const count = await revokeAllUserSessions("user-1", "sess-current");
      expect(count).toBe(3);
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", revokedAt: null, sessionToken: { not: "sess-current" } },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
