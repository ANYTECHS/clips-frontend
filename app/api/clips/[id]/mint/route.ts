import * as StellarSdk from "@stellar/stellar-sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  buildClipMintTransaction,
  ClipMintError,
  verifyClipMintTransaction,
} from "@/app/api/lib/clipNftMint";
import { auth } from "@/app/lib/auth";
import { getEndpointRateLimit } from "@/app/lib/endpointRateLimits";
import { logger } from "@/app/lib/logger";
import { buildClipNftMetadata, isClipMintable, MAX_ROYALTY_PERCENT } from "@/app/lib/mintUtils";
import { getNftContractId, getStellarNetwork } from "@/app/lib/networkConfig";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { triggerWebhookEvent } from "@/app/lib/webhooks/delivery";

import { clipsStore } from "../../clipsStore";

const publicKeySchema = z
  .string()
  .refine((key) => StellarSdk.StrKey.isValidEd25519PublicKey(key), "Invalid Stellar public key");

const buildSchema = z.object({
  publicKey: publicKeySchema,
  title: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  royaltyPercent: z.number().min(0).max(MAX_ROYALTY_PERCENT).optional(),
});

const recordSchema = z.object({
  publicKey: publicKeySchema,
  txHash: z.string().regex(/^[0-9a-f]{64}$/i, "Invalid transaction hash"),
});

type RouteContext = { params: Promise<{ id: string }> };

/** Auth, rate limit, clip ownership and contract configuration shared by both handlers. */
async function resolveMintContext(request: NextRequest, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const limited = await applyRateLimit(request, {
    ...getEndpointRateLimit("/api/clips/mint"),
    key: `user:${userId}:/api/clips/[id]/mint`,
  });
  if (limited) return { response: limited };

  const { id: clipId } = await context.params;
  const clip = clipsStore.getClipById(userId, clipId);
  if (!clip) {
    return {
      response: NextResponse.json({ error: "Clip not found", code: "CLIP_NOT_FOUND" }, { status: 404 }),
    };
  }

  const network = getStellarNetwork();
  const contractId = getNftContractId(network);
  if (!contractId) {
    logger.error("[clip-mint] NFT contract id is not configured for", network);
    return {
      response: NextResponse.json(
        { error: "NFT minting is not configured", code: "MINT_UNAVAILABLE" },
        { status: 503 }
      ),
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }

  return { userId, clip, network, contractId, body };
}

function errorResponse(err: unknown) {
  if (err instanceof ClipMintError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  logger.error("[clip-mint] Unexpected error:", err);
  return NextResponse.json({ error: "Failed to mint clip", code: "CONTRACT_ERROR" }, { status: 500 });
}

/**
 * POST /api/clips/:id/mint
 *
 * Builds the Soroban `mint` transaction for the clip and returns the
 * prepared XDR (for the user to sign) along with the estimated cost.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const ctx = await resolveMintContext(request, context);
  if ("response" in ctx) return ctx.response;
  const { clip, network, contractId, body } = ctx;

  if (!isClipMintable(clip)) {
    return NextResponse.json(
      { error: "This clip cannot be minted", code: "CLIP_NOT_MINTABLE" },
      { status: 409 }
    );
  }

  const parsed = buildSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }
  const { publicKey, ...overrides } = parsed.data;
  const metadata = buildClipNftMetadata(clip, overrides);

  try {
    const { xdr, estimate } = await buildClipMintTransaction({
      publicKey,
      contractId,
      metadata,
      uri: new URL(clip.thumbnail, request.nextUrl.origin).toString(),
      network,
    });

    return NextResponse.json({ data: { xdr, estimate, metadata, contractId }, error: null });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PUT /api/clips/:id/mint
 *
 * Records a submitted mint: verifies the transaction on-chain, then marks
 * the clip as minted and stores the NFT token id.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const ctx = await resolveMintContext(request, context);
  if ("response" in ctx) return ctx.response;
  const { userId, clip, network, contractId, body } = ctx;

  const parsed = recordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }
  const { publicKey, txHash } = parsed.data;

  if (clip.nftTokenId) {
    // Idempotent: recording the same mint twice returns the stored token id
    if (clip.nftTxHash?.toLowerCase() === txHash.toLowerCase()) {
      return NextResponse.json({ data: { tokenId: clip.nftTokenId, txHash }, error: null });
    }
    return NextResponse.json(
      { error: "Clip is already minted", code: "ALREADY_MINTED" },
      { status: 409 }
    );
  }

  try {
    const { tokenId } = await verifyClipMintTransaction({ txHash, publicKey, contractId, network });
    clipsStore.markClipMinted(userId, clip.id, { tokenId, txHash });

    void triggerWebhookEvent(userId, "mint_success", {
      clipIds: [clip.id],
      tokenId,
      txHash,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ data: { tokenId, txHash }, error: null });
  } catch (err) {
    return errorResponse(err);
  }
}
