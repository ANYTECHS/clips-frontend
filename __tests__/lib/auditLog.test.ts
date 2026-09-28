import {
  createAuditEvent,
  verifyAuditLogIntegrity,
  sanitizeAuditMetadata,
  computeEventHash,
  pruneAuditLogs,
  GENESIS_HASH,
} from "@/app/lib/auditLog";
import { prisma } from "@/app/lib/prisma";

jest.mock("@/app/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe("Audit Logging (Issue #1162)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sanitizeAuditMetadata", () => {
    it("redacts sensitive fields like passwords, tokens, secrets", () => {
      const input = {
        userId: "123",
        password: "super-secret-password",
        authToken: "jwt-token-string",
        apiSecretKey: "raw-api-key",
        nested: {
          privateKey: "pk-val",
          safeData: "hello",
        },
      };

      const sanitized = sanitizeAuditMetadata(input) as any;
      expect(sanitized.userId).toBe("123");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.authToken).toBe("[REDACTED]");
      expect(sanitized.apiSecretKey).toBe("[REDACTED]");
      expect(sanitized.nested.privateKey).toBe("[REDACTED]");
      expect(sanitized.nested.safeData).toBe("hello");
    });
  });

  describe("createAuditEvent", () => {
    it("creates an audit event with chained hash when no previous record exists (genesis)", async () => {
      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.auditLog.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: "log-1", ...data }));

      const result = await createAuditEvent({
        actorId: "user-1",
        actorType: "user",
        action: "auth.login",
        resource: "user",
        resourceId: "user-1",
        metadata: { ip: "127.0.0.1", userAgent: "test-agent" },
      });

      expect(result).toBeDefined();
      expect(result?.previousHash).toBe(GENESIS_HASH);
      expect(result?.eventHash).toBeDefined();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: "user-1",
            action: "auth.login",
            previousHash: GENESIS_HASH,
          }),
        })
      );
    });

    it("chains to the previous event hash when earlier records exist", async () => {
      const prevHash = "prev-hash-1234567890abcdef1234567890abcdef";
      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue({ eventHash: prevHash });
      (prisma.auditLog.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: "log-2", ...data }));

      const result = await createAuditEvent({
        actorId: "user-1",
        action: "api_key.create",
        resource: "api_key",
        resourceId: "key-1",
      });

      expect(result?.previousHash).toBe(prevHash);
    });
  });

  describe("verifyAuditLogIntegrity", () => {
    it("verifies an intact chain of audit logs", async () => {
      const event1Previous = GENESIS_HASH;
      const event1Hash = computeEventHash({
        previousHash: event1Previous,
        actorId: "user-1",
        action: "login",
        resource: "session",
        status: "success",
      });

      const event2Hash = computeEventHash({
        previousHash: event1Hash,
        actorId: "user-1",
        action: "upload",
        resource: "clip",
        status: "success",
      });

      const mockLogs = [
        {
          id: "1",
          previousHash: event1Previous,
          eventHash: event1Hash,
          actorId: "user-1",
          action: "login",
          resource: "session",
          status: "success",
        },
        {
          id: "2",
          previousHash: event1Hash,
          eventHash: event2Hash,
          actorId: "user-1",
          action: "upload",
          resource: "clip",
          status: "success",
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const verification = await verifyAuditLogIntegrity();
      expect(verification.verified).toBe(true);
      expect(verification.totalChecked).toBe(2);
    });

    it("detects tampered log when event content or hash was modified", async () => {
      const mockLogs = [
        {
          id: "1",
          previousHash: GENESIS_HASH,
          eventHash: "forged-or-modified-hash",
          actorId: "user-1",
          action: "login",
          resource: "session",
          status: "success",
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const verification = await verifyAuditLogIntegrity();
      expect(verification.verified).toBe(false);
      expect(verification.brokenId).toBe("1");
    });
  });

  describe("pruneAuditLogs", () => {
    it("deletes records older than retention threshold", async () => {
      (prisma.auditLog.deleteMany as jest.Mock).mockResolvedValue({ count: 42 });

      const result = await pruneAuditLogs(90);
      expect(result.deletedCount).toBe(42);
      expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({
        where: { timestamp: { lt: expect.any(Date) } },
      });
    });
  });
});
