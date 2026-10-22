import * as StellarSdk from "@stellar/stellar-sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/lib/auth";
import { getEndpointRateLimit } from "@/app/lib/endpointRateLimits";
import { logger } from "@/app/lib/logger";
import { getHorizonUrl, getNetworkPassphrase, getStellarNetwork } from "@/app/lib/networkConfig";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import {
  assertChangeTrustTx,
  buildChangeTrustTx,
  StellarTransactionError,
  submitEnvelope,
} from "@/app/lib/stellarTransaction";
import { type HorizonBalanceLine, parseHorizonTrustlines } from "@/app/lib/trustlineApi";

const ROUTE = "/api/wallet/trustline";

const publicKeySchema = z
  .string()
  .refine((key) => StellarSdk.StrKey.isValidEd25519PublicKey(key), "Invalid Stellar public key");

const networkSchema = z.enum(["testnet", "mainnet"]).optional();

const trustlineChangeSchema = z.object({
  publicKey: publicKeySchema,
  assetCode: z
    .string()
    .regex(/^[a-zA-Z0-9]{1,12}$/, "Asset code must be 1-12 alphanumeric characters"),
  assetIssuer: publicKeySchema,
  limit: z
    .string()
    .regex(/^\d+(\.\d{1,7})?$/, "Limit must be a positive number with up to 7 decimals")
    .optional(),
  network: networkSchema,
  signedXdr: z.string().min(1).optional(),
});

/** Map Stellar submission errors to HTTP responses. */
function errorResponse(err: unknown) {
  if (err instanceof StellarTransactionError) {
    const status = err.code === "network_error" || err.code === "timeout" ? 502 : 400;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  logger.error("[trustline] Unexpected error:", err);
  return NextResponse.json({ error: "Failed to update trustline" }, { status: 500 });
}

async function guard(request: NextRequest): Promise<NextResponse | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return applyRateLimit(request, {
    ...getEndpointRateLimit(ROUTE),
    key: `user:${userId}:${ROUTE}`,
  });
}

/**
 * Shared handler for POST (add) and DELETE (remove).
 *
 * Without `signedXdr` it builds the unsigned change-trust transaction for the
 * user to sign; with `signedXdr` it verifies the transaction matches the
 * request and submits it to Horizon.
 */
async function handleTrustlineChange(request: NextRequest, action: "add" | "remove") {
  const blocked = await guard(request);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = trustlineChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const { publicKey, assetCode, assetIssuer, limit, signedXdr } = parsed.data;
  const network = parsed.data.network ?? getStellarNetwork();
  const change = { sourcePublicKey: publicKey, assetCode, assetIssuer, action, network };

  try {
    if (!signedXdr) {
      const xdr = await buildChangeTrustTx({ ...change, limit });
      return NextResponse.json({
        data: { xdr, networkPassphrase: getNetworkPassphrase(network) },
        error: null,
      });
    }

    assertChangeTrustTx(signedXdr, change);
    const result = await submitEnvelope(signedXdr, network);
    return NextResponse.json({
      data: { hash: result.hash, ledger: result.ledger },
      error: null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * GET /api/wallet/trustline?publicKey=G...&network=testnet
 *
 * Lists the account's trustlines with asset code, issuer, balance and limit.
 */
export async function GET(request: NextRequest) {
  const blocked = await guard(request);
  if (blocked) return blocked;

  const { searchParams } = request.nextUrl;
  const publicKey = publicKeySchema.safeParse(searchParams.get("publicKey") ?? "");
  if (!publicKey.success) {
    return NextResponse.json({ error: "A valid publicKey is required" }, { status: 400 });
  }
  const network = networkSchema.parse(searchParams.get("network") ?? undefined) ?? getStellarNetwork();

  try {
    const res = await fetch(
      `${getHorizonUrl(network)}/accounts/${encodeURIComponent(publicKey.data)}`,
      { cache: "no-store" }
    );
    if (res.status === 404) {
      return NextResponse.json({ data: { trustlines: [] }, error: null });
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `Horizon returned HTTP ${res.status}`, code: "network_error" },
        { status: 502 }
      );
    }
    const account: { balances?: HorizonBalanceLine[] } = await res.json();
    return NextResponse.json({
      data: { trustlines: parseHorizonTrustlines(account.balances ?? []) },
      error: null,
    });
  } catch (err) {
    logger.error("[trustline] Failed to list trustlines:", err);
    return NextResponse.json({ error: "Failed to load trustlines" }, { status: 500 });
  }
}

/** POST /api/wallet/trustline — add (or update the limit of) a trustline. */
export async function POST(request: NextRequest) {
  return handleTrustlineChange(request, "add");
}

/** DELETE /api/wallet/trustline — remove a trustline (limit set to 0). */
export async function DELETE(request: NextRequest) {
  return handleTrustlineChange(request, "remove");
}
