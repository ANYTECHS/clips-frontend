import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { createAuditEvent } from "@/app/lib/auditLog";
import { logger } from "@/app/lib/logger";

/**
 * DELETE /api/auth/sessions/[id]
 * Revokes a specific session by session ID.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const result = await prisma.userSession.updateMany({
      where: {
        id,
        userId: session.user.id,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Session not found or already revoked" }, { status: 404 });
    }

    await createAuditEvent({
      actorId: session.user.id,
      action: "session.revoked",
      resource: "session",
      resourceId: id,
      status: "success",
    });

    return NextResponse.json({ success: true, message: "Session revoked successfully" });
  } catch (error) {
    logger.error("[Sessions API] Failed to revoke session:", error);
    return NextResponse.json({ error: "Failed to revoke session" }, { status: 500 });
  }
}
