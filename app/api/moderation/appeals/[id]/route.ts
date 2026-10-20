/**
 * PATCH /api/moderation/appeals/[id]
 *
 * Allows a reviewer to resolve an appeal as upheld or overturned with a resolution.
 * An overturned appeal creates a new decision with status: approved superseding the rejected one.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { authOptions } from "@/app/lib/auth";
import { checkCsrf } from "@/app/lib/csrf";
import { logger } from "@/app/lib/logger";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { prisma } from "@/app/lib/prisma";

export const ResolveAppealSchema = z.object({
  outcome: z.enum(["upheld", "overturned"]),
  resolution: z.string().min(1).max(2_000),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const parsedBody = await parseRequestJson(request);
    if (!parsedBody.ok) return parsedBody.response;

    const parsed = ResolveAppealSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 422 },
      );
    }

    const { outcome, resolution } = parsed.data;

    const appeal = await prisma.moderationAppeal.findUnique({
      where: { id },
      include: { decision: true },
    });
    if (!appeal) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    }
    if (appeal.status !== "open") {
      return NextResponse.json({ error: "Appeal is already resolved" }, { status: 409 });
    }

    // A creator must not resolve their own appeal
    if (appeal.userId === session.user.id) {
      return NextResponse.json(
        { error: "An appeal cannot be resolved by the creator who filed it" },
        { status: 403 },
      );
    }

    const resolved = await prisma.moderationAppeal.update({
      where: { id },
      data: {
        status: outcome,
        resolution,
        reviewerId: session.user.id,
        resolvedAt: new Date(),
      },
    });

    // Overturning has to move the content's status, not just close the appeal
    // — otherwise the creator wins the argument and still cannot publish.
    if (outcome === "overturned") {
      await prisma.moderationDecision.create({
        data: {
          contentId: appeal.decision.contentId,
          contentType: appeal.decision.contentType,
          userId: appeal.decision.userId,
          status: "approved",
          categories: appeal.decision.categories ?? undefined,
          score: null,
          source: "appeal",
          provider: null,
          reason: resolution,
          reviewerId: session.user.id,
          supersedesId: appeal.decisionId,
        },
      });
    }

    logger.info(`[moderation] appeal ${id} ${outcome} by ${session.user.id}`);

    return NextResponse.json({ success: true, appeal: resolved });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
