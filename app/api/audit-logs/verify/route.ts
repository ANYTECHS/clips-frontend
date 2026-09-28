import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { authenticateApiKey } from "@/app/api/lib/apiAuth";
import { verifyAuditLogIntegrity } from "@/app/lib/auditLog";
import { logger } from "@/app/lib/logger";

/**
 * GET /api/audit-logs/verify
 * Validates the cryptographic hash chain of the audit log repository.
 * Requires authenticated access.
 */
export async function GET(req: NextRequest) {
  try {
    let isAuthenticated = false;

    const session = await auth();
    if (session?.user?.id) {
      isAuthenticated = true;
    } else {
      const apiAuth = await authenticateApiKey(req);
      if (apiAuth.success) {
        isAuthenticated = true;
      }
    }

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
