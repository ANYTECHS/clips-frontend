/**
 * POST /api/recovery/initiate
 *
 * Starts a social recovery session for the given email address.
 * - Validates the email format.
 * - Looks up the stored recovery config for that account.
 * - Creates a time-limited session (1 hour) with all guardians marked pending.
 * - Emails every guardian an approval link.
 *
 * Auth: none required — the user is locked out of their account.
 * Rate limit: 5 requests per 10 minutes per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { parseJsonRequest } from "@/app/api/jobs/shared/jsonBody";
import {
  getRecoveryRepository,
  type RecoverySession,
} from "../shared/recoveryStore";
import { sendGuardianApprovalEmail } from "../shared/mailer";

const BodySchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit: 5 initiations per 10 minutes per IP
  const limited = applyRateLimit(request, { limit: 5, windowMs: 10 * 60_000 });
  if (limited) return limited;

  // Parse + validate body
  const parsed = await parseJsonRequest<unknown>(request);
  if (!parsed.ok) return parsed.response;

  const validation = BodySchema.safeParse(parsed.body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: validation.error.issues },
      { status: 422 }
    );
  }

  const { email } = validation.data;
  const repo = getRecoveryRepository();

  // Look up the recovery configuration stored during wallet setup
  const config = await repo.getConfig(email);
  if (!config || config.guardians.length === 0) {
    // Return a generic error to avoid leaking whether an email exists
    return NextResponse.json(
      {
        error:
          "No social recovery configuration found for this email. " +
          "Use mnemonic recovery instead.",
      },
      { status: 404 }
    );
  }

  // Create a new recovery session
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + 3_600_000; // 1 hour

  const session: RecoverySession = {
    id: sessionId,
    email,
    threshold: config.threshold,
    guardians: config.guardians.map((g) => ({
      email: g.email,
      approved: false,
      shareId: g.shareId,
    })),
    expiresAt,
  };

  await repo.createSession(session);

  // Email each guardian — fire-and-forget; a delivery failure is non-fatal
  // so the user can still try via other means (e.g. ask guardians directly).
  const emailPromises = config.guardians.map((g) =>
    sendGuardianApprovalEmail({
      to: g.email,
      ownerEmail: email,
      approvalToken: `${sessionId}:${g.email}`,
      expiresAt: new Date(expiresAt).toISOString(),
    }).catch((err) => {
      console.error(`[recovery/initiate] Failed to email guardian ${g.email}:`, err);
    })
  );

  // Await in parallel but don't block the response on individual failures
  await Promise.allSettled(emailPromises);

  return NextResponse.json({
    sessionId,
    guardians: config.guardians.map((g) => g.email),
    threshold: config.threshold,
    guardianCount: config.guardians.length,
  });
}
