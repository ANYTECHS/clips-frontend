/**
 * /api/recovery/share
 *
 * POST — Stores one guardian's encrypted Shamir share for the signed-in user.
 *   Expected body: { guardianEmail, encryptedShare, threshold, totalShares }
 *
 *   The share is encrypted client-side with the guardian's public key before
 *   it is sent, so the server only ever stores ciphertext.
 *
 *   Auth: signed-in user with a verified email address (Issue #1210).
 *   Rate limit: 30 requests per minute per IP.
 *
 * GET ?sessionId=<id>&guardianEmail=<email> — Returns the encrypted share for
 *   a guardian of an active recovery session, so the guardian can decrypt it
 *   with their private key and hand the plaintext share to the account owner.
 *   The ciphertext is useless without the guardian's private key.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonRequest } from "@/app/api/jobs/shared/jsonBody";
import { isEmailVerified } from "@/app/lib/emailVerification";
import { getAuthUserId } from "@/app/lib/getAuthUserId";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { applyRateLimit } from "@/app/lib/serverRateLimit";

import { getRecoveryRepository, type RecoveryConfig } from "../shared/recoveryStore";

const MAX_SHARES = 10;

const BodySchema = z
  .object({
    guardianEmail: z.string().email("Invalid guardian email"),
    encryptedShare: z.string().min(1, "encryptedShare is required").max(4096),
    threshold: z.number().int().min(2),
    totalShares: z.number().int().min(2).max(MAX_SHARES),
  })
  .refine((b) => b.threshold <= b.totalShares, {
    message: "threshold cannot exceed totalShares",
    path: ["threshold"],
  });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = await applyRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isEmailVerified(userId))) {
    return NextResponse.json(
      { error: "Verify your email address before configuring social recovery." },
      { status: 403 }
    );
  }

  const parsed = await parseJsonRequest<unknown>(request);
  if (!parsed.ok) return parsed.response;

  const validation = BodySchema.safeParse(parsed.body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: validation.error.issues },
      { status: 422 }
    );
  }

  const { guardianEmail, encryptedShare, threshold, totalShares } = validation.data;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const ownerEmail = user.email;
    const repo = getRecoveryRepository();
    const existing = await repo.getConfig(ownerEmail);

    // A changed threshold/share count means a fresh split — old shares are
    // incompatible, so start the guardian list over.
    const config: RecoveryConfig =
      existing &&
      existing.threshold === threshold &&
      (existing.totalShares ?? existing.guardians.length) === totalShares
        ? existing
        : { email: ownerEmail, threshold, totalShares, guardians: [] };

    let guardian = config.guardians.find(
      (g) => g.email.toLowerCase() === guardianEmail.toLowerCase()
    );
    if (!guardian) {
      if (config.guardians.length >= totalShares) {
        return NextResponse.json(
          { error: `All ${totalShares} guardian shares are already stored.` },
          { status: 409 }
        );
      }
      guardian = { email: guardianEmail, shareId: crypto.randomUUID() };
      config.guardians.push(guardian);
    }

    await repo.setShare(guardian.shareId, encryptedShare);
    await repo.setConfig(config);

    return NextResponse.json({
      success: true,
      guardianEmail: guardian.email,
      storedShares: config.guardians.length,
      totalShares,
      threshold,
    });
  } catch (err) {
    logger.error("[recovery/share] Failed to store guardian share:", err);
    return NextResponse.json({ error: "Failed to store guardian share." }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = await applyRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
  const guardianEmail = request.nextUrl.searchParams.get("guardianEmail") ?? "";
  if (!sessionId || !guardianEmail) {
    return NextResponse.json(
      { error: "Missing required query parameters: sessionId, guardianEmail" },
      { status: 400 }
    );
  }

  const repo = getRecoveryRepository();
  const session = await repo.getSession(sessionId);
  if (!session || Date.now() > session.expiresAt) {
    return NextResponse.json(
      { error: "Invalid or expired session. Please initiate recovery again." },
      { status: 404 }
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

  const encryptedShare = await repo.getShare(guardian.shareId);
  if (!encryptedShare) {
    return NextResponse.json({ error: "No share stored for this guardian." }, { status: 404 });
  }

  return NextResponse.json({ ownerEmail: session.email, encryptedShare });
}
