import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getUserActiveSessions, revokeAllUserSessions } from "@/app/lib/sessionSecurity";
import { logger } from "@/app/lib/logger";

/**
 * GET /api/auth/sessions
 * Returns all active tracked sessions for the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentToken =
      req.cookies.get("__Secure-next-auth.session-token")?.value ||
      req.cookies.get("next-auth.session-token")?.value;

    const sessions = await getUserActiveSessions(session.user.id, currentToken);
    return NextResponse.json({ sessions });
  } catch (error) {
    logger.error("[Sessions API] Failed to fetch user sessions:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/sessions
 * Revokes sessions. Supports query param `revokeAll=true` or revoking all other sessions.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const revokeAll = searchParams.get("all") === "true";

    const currentToken =
      req.cookies.get("__Secure-next-auth.session-token")?.value ||
      req.cookies.get("next-auth.session-token")?.value;

    const count = await revokeAllUserSessions(
      session.user.id,
      revokeAll ? undefined : currentToken
    );

    return NextResponse.json({
      success: true,
      revokedCount: count,
      message: revokeAll
        ? "All sessions revoked"
        : "All other sessions revoked",
    });
  } catch (error) {
    logger.error("[Sessions API] Failed to revoke sessions:", error);
    return NextResponse.json({ error: "Failed to revoke sessions" }, { status: 500 });
  }
}
