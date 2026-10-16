/**
 * GET /api/moderation/[id]/chain
 *
 * Returns the full decision chain for a content item by following supersedesId links.
 * This allows reconstruction of the complete history of how a piece of content was judged.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as Sentry from "@sentry/nextjs";

import { authOptions } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Start with the given decision
    const decision = await prisma.moderationDecision.findUnique({
      where: { id },
      include: { appeals: true },
    });

    if (!decision) {
      return NextResponse.json({ error: "Decision not found" }, { status: 404 });
    }

    // Build the chain by following supersedesId links backwards
    const chain: typeof decision[] = [decision];
    let current = decision;

    // Follow the chain backwards to find the original decision
    while (current.supersedesId) {
      const previous = await prisma.moderationDecision.findUnique({
        where: { id: current.supersedesId },
        include: { appeals: true },
      });
      if (!previous) break;
      chain.unshift(previous); // Add to beginning of array
      current = previous;
    }

    // Find all decisions that supersede the current one (forward chain)
    // This is useful to see what happened after a particular decision
    const forwardChain = await prisma.moderationDecision.findMany({
      where: { supersedesId: id },
      include: { appeals: true },
      orderBy: { createdAt: "asc" },
    });

    logger.info(`[moderation] Chain returned for decision ${id}: ${chain.length} decisions`);

    return NextResponse.json({
      success: true,
      chain,
      forwardChain,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error("[moderation] Chain fetch failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
