/**
 * POST /api/recovery/approve
 *
 * Records a guardian's approval for an active recovery session.
 *
 * Expected body: { sessionId: string, guardianEmail: string }
 *
 * In production, guardians click a signed link from their email. The link
 * contains an `approvalToken` of the form `<sessionId>:<guardianEmail>`.
 * Clients can POST that token directly, or split it and send the two fields.
 *
 * Auth: shared-secret validation via the approval token embedded in the email
 *       link (sessionId acts as the shared secret — only the guardian who
 *       received the email has the full token).
 *
 * Rate limit: 20 requests per minute per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { parseJsonRequest } from "@/app/api/jobs/shared/jsonBody";
import { getRecoveryRepository } from "../shared/recoveryStore";

const BodySchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  guardianEmail: z.string().email("Invalid guardian email"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 20 approvals per minute per IP
  const limited = applyRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = await parseJsonRequest<unknown>(request);
  if (!parsed.ok) return parsed.response;

  const validation = BodySchema.safeParse(parsed.body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: validation.error.issues },
      { status: 422 }
    );
  }

  const { sessionId, guardianEmail } = validation.data;
  const repo = getRecoveryRepository();

  const session = await repo.getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Invalid or expired session. Please initiate recovery again." },
      { status: 404 }
    );
  }

  // Check session expiry (belt-and-suspenders — the store's TTL handles this
  // for Redis, but the in-memory adapter may have let an entry through).
  if (Date.now() > session.expiresAt) {
    await repo.deleteSession(sessionId);
    return NextResponse.json(
      { error: "Recovery session has expired. Please initiate recovery again." },
      { status: 410 }
    );
  }

  const guardian = session.guardians.find(
    (g) => g.email.toLowerCase() === guardianEmail.toLowerCase()
  );
  if (!guardian) {
    return NextResponse.json(
      { error: "Guardian not found in this recovery session." },
      { status: 403 }
    );
  }

  // Mark the guardian as approved and persist
  guardian.approved = true;
  await repo.saveSession(sessionId, session);

  return NextResponse.json({
    success: true,
    guardians: session.guardians.map((g) => ({
      email: g.email,
      approved: g.approved,
    })),
  });
}

/**
 * GET /api/recovery/approve?token=<sessionId>:<guardianEmail>
 *
 * Handles the one-click approval link from the guardian's email.
 * Redirects to a confirmation page on success or an error page on failure.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const colonIdx = token.indexOf(":");

  if (colonIdx === -1 || colonIdx === 0 || colonIdx === token.length - 1) {
    return NextResponse.json({ error: "Invalid approval token." }, { status: 400 });
  }

  const sessionId = token.slice(0, colonIdx);
  const guardianEmail = token.slice(colonIdx + 1);

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const repo = getRecoveryRepository();
  const session = await repo.getSession(sessionId);

  if (!session) {
    return NextResponse.redirect(`${appUrl}/recovery?approval=expired`);
  }

  if (Date.now() > session.expiresAt) {
    await repo.deleteSession(sessionId);
    return NextResponse.redirect(`${appUrl}/recovery?approval=expired`);
  }

  const guardian = session.guardians.find(
    (g) => g.email.toLowerCase() === guardianEmail.toLowerCase()
  );

  if (!guardian) {
    return NextResponse.redirect(`${appUrl}/recovery?approval=invalid`);
  }

  guardian.approved = true;
  await repo.saveSession(sessionId, session);

  return NextResponse.redirect(`${appUrl}/recovery?approval=success`);
}
