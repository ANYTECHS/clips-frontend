/**
 * GET /api/recovery/check?sessionId=<id>
 *
 * Polls the status of a social recovery session.
 * - Returns approval counts and per-guardian status.
 * - When the approval threshold is met, reconstructs the encrypted backup
 *   from the guardian shares using Shamir's Secret Sharing and returns it.
 *   The client then decrypts the backup with their recovery password (fully
 *   client-side — the server never sees the plaintext key).
 *
 * Auth: the sessionId acts as a shared secret (only the account owner who
 *       initiated recovery has it — treat it like a short-lived token).
 *
 * Rate limit: 30 requests per minute per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { getRecoveryRepository } from "../shared/recoveryStore";
import { combineShares } from "@/app/lib/shamirRecovery";

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

  let encryptedBackup: string | null = null;

  if (isRecoverable) {
    // Collect the minimum number of shares needed to reconstruct the secret
    const shareIds = approvedGuardians
      .slice(0, session.threshold)
      .map((g) => g.shareId);

    const shareValues: string[] = [];
    for (const shareId of shareIds) {
      const share = await repo.getShare(shareId);
      if (share) shareValues.push(share);
    }

    if (shareValues.length >= session.threshold) {
      try {
        encryptedBackup = combineShares(shareValues.slice(0, session.threshold));
      } catch (err) {
        console.error("[recovery/check] Failed to combine shares:", err);
        return NextResponse.json(
          { error: "Failed to reconstruct backup. Contact support." },
          { status: 500 }
        );
      }
    }
  }

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
    encryptedBackup,
  });
}
