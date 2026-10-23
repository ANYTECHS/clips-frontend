import * as StellarSdk from "@stellar/stellar-sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  countSponsorshipsThisMonth,
  evaluateSponsorshipBudget,
  getMonthlySponsorshipLimit,
  isEligibleForSponsorship,
  SPONSORSHIP_AUDIT_ACTION,
  validateInnerTransaction,
} from "@/app/api/lib/sponsorshipPolicy";
import { auth } from "@/app/lib/auth";
import { createAuditEvent } from "@/app/lib/auditLog";
import { getEndpointRateLimit } from "@/app/lib/endpointRateLimits";
import { logger } from "@/app/lib/logger";
import { getNftContractId, getStellarNetwork } from "@/app/lib/networkConfig";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { buildFeeBumpedTx, fetchAccountXlmStatus } from "@/app/lib/stellarTransaction";

const ROUTE = "/api/sponsorship/sponsor";

const sponsorRequestSchema = z.object({
  innerXdr: z.string().min(1, "innerXdr is required"),
  publicKey: z
    .string()
    .refine((key) => StellarSdk.StrKey.isValidEd25519PublicKey(key), "Invalid Stellar public key"),
});

/**
 * POST /api/sponsorship/sponsor
 *
 * Wraps a user-signed inner transaction in a fee-bump envelope signed by the
 * platform sponsor account (`SPONSOR_SECRET_KEY`, server-side only) and
 * returns the signed fee-bump XDR for the client to submit.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await applyRateLimit(request, {
    ...getEndpointRateLimit(ROUTE),
    key: `user:${userId}:${ROUTE}`,
  });
  if (limited) return limited;

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  const audit = (
    status: "success" | "failure",
    metadata: Record<string, unknown>,
    resourceId?: string
  ) =>
    createAuditEvent({
      actorId: userId,
      action: SPONSORSHIP_AUDIT_ACTION,
      resource: "sponsorship",
      resourceId: resourceId ?? null,
      ipAddress,
      userAgent,
      status,
      metadata,
    });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sponsorRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { innerXdr, publicKey } = parsed.data;

  const sponsorSecret = process.env.SPONSOR_SECRET_KEY;
  if (!sponsorSecret) {
    logger.error("[sponsorship] SPONSOR_SECRET_KEY is not configured");
    return NextResponse.json(
      { error: "Fee sponsorship is not available", code: "SPONSORSHIP_UNAVAILABLE" },
      { status: 503 }
    );
  }

  try {
    const network = getStellarNetwork();

    const validation = validateInnerTransaction(
      innerXdr,
      publicKey,
      network,
      getNftContractId(network)
    );
    if (!validation.ok) {
      await audit("failure", { publicKey, network, reason: validation.code });
      return NextResponse.json({ error: validation.error, code: validation.code }, { status: 400 });
    }

    const innerTx = validation.tx;
    const innerHash = innerTx.hash().toString("hex");
    const innerFee = Number(innerTx.fee);

    const accountStatus = await fetchAccountXlmStatus(publicKey, network);
    if (!isEligibleForSponsorship(accountStatus, innerFee)) {
      await audit("failure", { publicKey, network, reason: "NOT_ELIGIBLE" }, innerHash);
      return NextResponse.json(
        {
          error: "Your XLM balance already covers this transaction fee.",
          code: "NOT_ELIGIBLE",
        },
        { status: 403 }
      );
    }

    const budget = evaluateSponsorshipBudget(
      await countSponsorshipsThisMonth(userId),
      getMonthlySponsorshipLimit()
    );
    if (!budget.allowed) {
      await audit(
        "failure",
        { publicKey, network, reason: "BUDGET_EXCEEDED", limit: budget.limit },
        innerHash
      );
      return NextResponse.json(
        {
          error: `Monthly sponsorship limit of ${budget.limit} reached.`,
          code: "BUDGET_EXCEEDED",
        },
        { status: 429 }
      );
    }

    const sponsorKeypair = StellarSdk.Keypair.fromSecret(sponsorSecret);
    const feeBumpTx = buildFeeBumpedTx(innerTx, sponsorKeypair, { network });
    const feeBumpHash = feeBumpTx.hash().toString("hex");

    await audit(
      "success",
      {
        publicKey,
        network,
        operations: validation.operations,
        innerHash,
        feeStroops: feeBumpTx.fee,
        sponsorPublicKey: sponsorKeypair.publicKey(),
      },
      feeBumpHash
    );

    return NextResponse.json({
      data: {
        feeBumpXdr: feeBumpTx.toEnvelope().toXDR("base64"),
        hash: feeBumpHash,
        feeStroops: feeBumpTx.fee,
        sponsorPublicKey: sponsorKeypair.publicKey(),
        remaining: budget.remaining - 1,
      },
      error: null,
    });
  } catch (error) {
    logger.error("[sponsorship] Failed to sponsor transaction:", error);
    await audit("failure", { publicKey, reason: "INTERNAL_ERROR" });
    return NextResponse.json({ error: "Failed to sponsor transaction" }, { status: 500 });
  }
}
