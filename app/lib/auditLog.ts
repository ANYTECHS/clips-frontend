import crypto from "crypto";
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";

export const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

export interface CreateAuditEventInput {
  actorId: string;
  actorType?: "user" | "api_key" | "system" | "admin";
  action: string;
  resource: string;
  resourceId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  status?: "success" | "failure";
  metadata?: Record<string, unknown> | null;
}

export interface AuditIntegrityResult {
  verified: boolean;
  totalChecked: number;
  brokenIndex?: number;
  brokenId?: string;
  reason?: string;
}

/**
 * Strips sensitive credentials (passwords, tokens, secrets, full keys)
 * from audit log metadata before saving.
 */
export function sanitizeAuditMetadata(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeAuditMetadata(item, depth + 1));
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("authorization") ||
        lowerKey.includes("keyhash") ||
        lowerKey.includes("private") ||
        lowerKey.includes("cookie") ||
        lowerKey.includes("credential")
      ) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeAuditMetadata(value, depth + 1);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Computes deterministic SHA-256 event hash incorporating the previous hash in the chain.
 */
export function computeEventHash(params: {
  previousHash: string;
  actorId: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  status: string;
  metadata?: unknown;
}): string {
  const normMetadata = params.metadata ? JSON.stringify(params.metadata) : "";
  const payload = [
    params.previousHash,
    params.actorId,
    params.action,
    params.resource,
    params.resourceId ?? "",
    params.status,
    normMetadata,
  ].join("|");

  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Appends a new tamper-evident audit log to the database.
 */
export async function createAuditEvent(input: CreateAuditEventInput) {
  try {
    const actorType = input.actorType ?? "user";
    const status = input.status ?? "success";
    const sanitizedMetadata = input.metadata
      ? (sanitizeAuditMetadata(input.metadata) as Record<string, unknown>)
      : null;

    // Get previous event hash in chain (or genesis if first record)
    const latestEvent = await prisma.auditLog.findFirst({
      orderBy: { timestamp: "desc" },
      select: { eventHash: true },
    });

    const previousHash = latestEvent?.eventHash ?? GENESIS_HASH;

    const eventHash = computeEventHash({
      previousHash,
      actorId: input.actorId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      status,
      metadata: sanitizedMetadata,
    });

    return await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        actorType,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        requestId: input.requestId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        status,
        metadata: sanitizedMetadata as any,
        schemaVersion: 1,
        previousHash,
        eventHash,
      },
    });
  } catch (error) {
    // Fail-safe: audit log creation failures are logged to stderr without bringing down core request flows
    logger.error("[AuditLog] Failed to create audit event:", error);
    return null;
  }
}

/**
 * Validates the chronological cryptographic hash chain of stored audit logs.
 */
export async function verifyAuditLogIntegrity(options: { take?: number } = {}): Promise<AuditIntegrityResult> {
  const take = options.take ?? 1000;
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "asc" },
    take,
  });

  if (logs.length === 0) {
    return { verified: true, totalChecked: 0 };
  }

  let expectedPreviousHash = logs[0].previousHash ?? GENESIS_HASH;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    // Check chained hash reference
    if (log.previousHash !== expectedPreviousHash) {
      return {
        verified: false,
        totalChecked: i,
        brokenIndex: i,
        brokenId: log.id,
        reason: `Previous hash mismatch: expected ${expectedPreviousHash}, found ${log.previousHash}`,
      };
    }

    // Verify self hash computation
    const computed = computeEventHash({
      previousHash: log.previousHash,
      actorId: log.actorId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      status: log.status,
      metadata: log.metadata,
    });

    if (computed !== log.eventHash) {
      return {
        verified: false,
        totalChecked: i,
        brokenIndex: i,
        brokenId: log.id,
        reason: `Event hash mismatch: computed ${computed}, stored ${log.eventHash}`,
      };
    }

    expectedPreviousHash = log.eventHash;
  }

  return { verified: true, totalChecked: logs.length };
}

/**
 * Prunes audit records older than the configured retention policy (default: 90 days).
 */
export async function pruneAuditLogs(olderThanDays?: number): Promise<{ deletedCount: number }> {
  const days = olderThanDays ?? parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || "90", 10);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoff },
      },
    });

    logger.info(`[AuditLog] Pruned ${result.count} audit records older than ${days} days`);
    return { deletedCount: result.count };
  } catch (error) {
    logger.error("[AuditLog] Failed to prune audit logs:", error);
    return { deletedCount: 0 };
  }
}
