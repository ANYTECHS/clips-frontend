/**
 * GET /api/moderation/queue
 *
 * Returns pending moderation decisions sorted by oldest first (admin only).
 * This is the review queue that moderators poll to see what needs human review.
 *
 * Acceptance Criteria:
 * - Returns decisions with status: pending sorted by oldest first
 * - Admin only access
 * - Excludes superseded decisions (they're history, not queue entries)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { authOptions } from "@/app/lib/auth";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";

const QueueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  contentType: z.enum(["clip", "caption", "thumbnail"]).optional(),
});

/**
 * Check if the user is an admin
 */
async function isAdmin(userId: string): Promise<boolean> {
  // In a real implementation, this would check against an admin role in the database
  // For now, we'll check if the user has a specific email domain or role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, plan: true },
  });

  if (!user) return false;

  // Admins are users with "admin" in their email or a specific plan
  // This is a placeholder - implement proper role-based access control
  return user.email?.includes("admin") || user.plan === "admin";
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin permissions
    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
      return NextResponse.json({ error: "Forbidden - admin access required" }, { status: 403 });
    }

    const parsed = QueueQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const { limit, contentType } = parsed.data;

    // Get IDs of superseded decisions to exclude them from the queue
    const superseded = await prisma.moderationDecision.findMany({
      where: { supersedesId: { not: null } },
      select: { supersedesId: true },
    });
    const supersededIds = superseded
      .map((row) => row.supersedesId)
      .filter((id): id is string => id !== null);

    // Query pending decisions, sorted by oldest first
    const decisions = await prisma.moderationDecision.findMany({
      where: {
        status: "pending",
        id: { notIn: supersededIds },
        ...(contentType ? { contentType } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      include: {
        appeals: {
          where: { status: "open" },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    logger.info(`[moderation] Queue returned ${decisions.length} pending decisions`);

    return NextResponse.json({ success: true, decisions });
  } catch (error) {
    Sentry.captureException(error);
    logger.error("[moderation] Queue fetch failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
