import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { requireScope, type ApiKeyRouteContext } from "@/app/lib/apiKey";
import { verifyAuditLogIntegrity } from "@/app/lib/auditLog";
import { logger } from "@/app/lib/logger";

/**
 * GET /api/audit-logs/verify
 * Validates the cryptographic hash chain of the audit log repository.
 * Requires authenticated access.
 */
async function verifyAuditLogs(req: NextRequest, context?: ApiKeyRouteContext) {
  try {
    const session = context?.apiKey ? null : await auth();
    const isAuthenticated = Boolean(context?.apiKey.userId || session?.user?.id);

    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const take = Math.min(5000, parseInt(searchParams.get("limit") || "1000", 10));

    const result = await verifyAuditLogIntegrity({ take });

    return NextResponse.json({
      verified: result.verified,
      totalChecked: result.totalChecked,
      brokenId: result.brokenId,
      reason: result.reason,
    });
  } catch (error) {
    logger.error("[AuditLog Verify API] Verification failed:", error);
    return NextResponse.json({ error: "Failed to verify audit logs" }, { status: 500 });
  }
}

const verifyAuditLogsWithScope = requireScope("audit:read")(verifyAuditLogs);

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("authorization") ?? "";
  const hasApiKey = req.headers.has("x-api-key") || /^Bearer\s+(ck_|ak_)/i.test(authorization);
  return hasApiKey ? verifyAuditLogsWithScope(req) : verifyAuditLogs(req);
}
