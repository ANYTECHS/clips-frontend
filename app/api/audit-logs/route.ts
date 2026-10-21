import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { requireScope, type ApiKeyRouteContext } from "@/app/lib/apiKey";
import { logger } from "@/app/lib/logger";

/**
 * GET /api/audit-logs
 * Retrieves paginated audit logs with filtering by actor, action, resource, date, and status.
 * Requires an authenticated user session or a valid API key with audit scopes.
 */
async function getAuditLogs(req: NextRequest, context?: ApiKeyRouteContext) {
  try {
    let authenticatedUserId: string | null = context?.apiKey.userId ?? null;

    if (!authenticatedUserId) {
      const session = await auth();
      authenticatedUserId = session?.user?.id ?? null;
    }

    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const action = searchParams.get("action") || undefined;
    const actorId = searchParams.get("actorId") || undefined;
    const resource = searchParams.get("resource") || undefined;
    const status = searchParams.get("status") || undefined;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = {};

    if (action) where.action = { contains: action, mode: "insensitive" };
    if (actorId) where.actorId = actorId;
    if (resource) where.resource = resource;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    logger.error("[AuditLogs API] Failed to fetch audit logs:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}

const getAuditLogsWithScope = requireScope("audit:read")(getAuditLogs);

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("authorization") ?? "";
  const hasApiKey = req.headers.has("x-api-key") || /^Bearer\s+(ck_|ak_)/i.test(authorization);
  return hasApiKey ? getAuditLogsWithScope(req) : getAuditLogs(req);
}
