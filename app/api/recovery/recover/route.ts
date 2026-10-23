/**
 * POST /api/recovery/recover
 *
 * Combines guardian-provided Shamir shares and returns the recovered key.
 *
 * Expected body: { sessionId, verificationToken, shares: string[] }
 *
 * - `shares` are the plaintext shares each guardian decrypted with their
 *   private key. At least `threshold` distinct shares are required.
 * - `verificationToken` is the email verification token sent to the account
 *   owner when recovery was initiated (Issue #1210). It must be bound to this
 *   session and the account email, proving the requester controls the inbox.
 *
 * The recovered key is the password-encrypted wallet backup; the client
 * decrypts it locally with the recovery password, so the server never sees
 * the plaintext secret key.
 *
 * Rate limit: 10 requests per 10 minutes per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonRequest } from "@/app/api/jobs/shared/jsonBody";
import { validateEmailVerificationToken } from "@/app/lib/emailVerification";
import { logger } from "@/app/lib/logger";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { combineShares } from "@/app/lib/shamirRecovery";

import { getRecoveryRepository } from "../shared/recoveryStore";

const BodySchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  verificationToken: z.string().min(1, "verificationToken is required"),
  shares: z.array(z.string().min(1).max(2048)).min(2).max(10),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = await applyRateLimit(request, { limit: 10, windowMs: 10 * 60_000 });
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

  const { sessionId, verificationToken, shares } = validation.data;
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

  let claims: ReturnType<typeof validateEmailVerificationToken> = null;
  try {
    claims = validateEmailVerificationToken(verificationToken);
  } catch (err) {
    logger.error("[recovery/recover] Email verification unavailable:", err);
  }
  if (
    !claims ||
    claims.sub !== sessionId ||
    claims.email.toLowerCase() !== session.email.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "Email verification failed. Use the link sent to your account email." },
      { status: 403 }
    );
  }

  const distinctShares = Array.from(new Set(shares.map((s) => s.trim())));
  if (distinctShares.length < session.threshold) {
    return NextResponse.json(
      {
        error: `Insufficient shares: ${distinctShares.length} provided, ${session.threshold} required.`,
      },
      { status: 422 }
    );
  }

  let recoveredKey: string;
  try {
    recoveredKey = combineShares(distinctShares, session.threshold);
  } catch (err) {
    logger.error("[recovery/recover] Failed to combine shares:", err);
    return NextResponse.json(
      { error: "Could not combine shares. Check that each share was copied correctly." },
      { status: 422 }
    );
  }

  // The session is left to expire rather than deleted: a mistyped share still
  // combines "successfully" into garbage that only fails at client-side
  // decryption, and the user needs the session to retry.
  return NextResponse.json({ success: true, recoveredKey });
}
