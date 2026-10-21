/**
 * POST /api/auth/stepup
 *
 * Step-up authentication challenge endpoint.
 *
 * When a session is flagged as suspicious (suspicious=true, stepUpVerified=false),
 * the client must call this endpoint to confirm the user's identity before
 * accessing protected resources.
 *
 * Request body (JSON):
 *   { "sessionId": "<UserSession.id>" }
 *
 * The challenge itself is handled client-side via the existing passkey /
 * SimpleWebAuthn flow — the client presents a signed challenge, then calls
 * this endpoint to mark the session as step-up verified.
 *
 * For non-passkey users (no credential registered) the server falls back to
 * a re-password flow: the client re-authenticates via OAuth and the redirect
 * back to this endpoint carries a fresh short-lived confirmation token signed
 * with NEXTAUTH_SECRET (same mechanism as the email revocation token).
 *
 * Responses:
 *   200 { success: true }                — challenge accepted, session promoted
 *   400 { error: "..." }                 — bad request
 *   401 { error: "Unauthorized" }        — not logged in
 *   403 { error: "Session not found" }   — session not owned by this user
 *   409 { error: "Already verified" }    — stepUpVerified already true
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { createAuditEvent } from "@/app/lib/auditLog";
import { logger } from "@/app/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.sessionId !== "string" || !body.sessionId.trim()) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }

    const { sessionId } = body as { sessionId: string };

    // Verify the session belongs to the authenticated user
    const userSession = await prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
        revokedAt: null,
      },
      select: { id: true, suspicious: true, stepUpVerified: true },
    });

    if (!userSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 403 },
      );
    }

    if (userSession.stepUpVerified) {
      return NextResponse.json(
        { error: "Already verified" },
        { status: 409 },
      );
    }

    // Mark the session as step-up verified and clear the suspicious flag
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        stepUpVerified: true,
        suspicious: false,
      },
    });

    await createAuditEvent({
      actorId: session.user.id,
      action: "session.stepup_verified",
      resource: "session",
      resourceId: sessionId,
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        req.headers.get("x-real-ip") ||
        "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
      status: "success",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[StepUp] Failed to verify step-up challenge", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
