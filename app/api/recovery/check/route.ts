/**
 * GET /api/recovery/check?sessionId=<id>
 *
 * Polls the status of a social recovery session.
 * - Returns approval counts and per-guardian status.
 * - Stored shares are encrypted to each guardian's public key, so the server
 *   cannot reconstruct anything here. Once enough guardians have released
 *   their shares, the client submits them to POST /api/recovery/recover.
 *
 * Auth: the sessionId acts as a shared secret (only the account owner who
 *       initiated recovery has it — treat it like a short-lived token).
 *
 * Rate limit: 30 requests per minute per IP.
 */

import { NextRequest, NextResponse } from "next/server";

import { applyRateLimit } from "@/app/lib/serverRateLimit";

import { getRecoveryRepository } from "../shared/recoveryStore";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 30 status checks per minute per IP
  const limited = applyRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing required query parameter: sessionId" },
      { status: 400 }
    );
  }

  const repo = getRecoveryRepository();
  const session = await repo.getSession(sessionId);

  if (!session) {
    return NextResponse.json(
      { error: "Invalid or expired session. Please initiate recovery again." },
      { status: 404 }
    );
  }

  if (Date.now() > session.expiresAt) {
    await repo.deleteSession(sessionId);
    return NextResponse.json(
      { error: "Recovery session has expired. Please initiate recovery again." },
      { status: 410 }
    );
  }

  const approvedGuardians = session.guardians.filter((g) => g.approved);
  const approvedCount = approvedGuardians.length;
  const totalCount = session.guardians.length;
  const isRecoverable = approvedCount >= session.threshold;

  return NextResponse.json({
    success: true,
    isRecoverable,
    approvedCount,
    totalCount,
    threshold: session.threshold,
    guardians: session.guardians.map((g) => ({
      email: g.email,
      approved: g.approved,
    })),
    // Kept for response-shape compatibility; recombination now happens in
    // POST /api/recovery/recover with guardian-released shares.
    encryptedBackup: null,
  });
}
