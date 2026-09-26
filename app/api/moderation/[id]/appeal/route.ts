/**
 * Appeals against a moderation decision (Issue #1063).
 *
 * `POST` opens an appeal (creator). `PATCH` resolves one (reviewer); an
 * overturned appeal appends a new `approved` decision superseding the one that
 * was challenged, so the content's current status follows from the same chain
 * everything else reads.
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
import { isAppealable } from "@/app/lib/moderation/types";
import type { ModerationStatus } from "@/app/lib/moderation/types";

export const AppealSchema = z.object({
  statement: z.string().min(20, "Tell us why in at least a sentence").max(4_000),
});

export const ResolveAppealSchema = z.object({
  appealId: z.string().min(1),
  outcome: z.enum(["upheld", "overturned"]),
  resolution: z.string().min(1).max(2_000),
});

export async function POST(
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

    const parsed = AppealSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 422 },
      );
    }

    const decision = await prisma.moderationDecision.findUnique({ where: { id } });
    if (!decision) {
      return NextResponse.json({ error: "Decision not found" }, { status: 404 });
    }

    // Only the creator whose content it is may appeal it.
    if (decision.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isAppealable(decision.status as ModerationStatus)) {
      return NextResponse.json(
        { error: "Only flagged or rejected content can be appealed" },
        { status: 409 },
      );
    }

    const existing = await prisma.moderationAppeal.findFirst({
      where: { decisionId: id, status: "open" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An appeal on this decision is already open" },
        { status: 409 },
      );
    }

    const appeal = await prisma.moderationAppeal.create({
      data: {
        decisionId: id,
        userId: session.user.id,
        statement: parsed.data.statement,
        status: "open",
      },
    });

    logger.info(`[moderation] appeal opened on decision ${id} by ${session.user.id}`);

    return NextResponse.json({ success: true, appeal }, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    const { appealId, outcome, resolution } = parsed.data;

    const appeal = await prisma.moderationAppeal.findUnique({
      where: { id: appealId },
      include: { decision: true },
    });
    if (!appeal || appeal.decisionId !== id) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    }
    if (appeal.status !== "open") {
      return NextResponse.json({ error: "Appeal is already resolved" }, { status: 409 });
    }

    // A creator must not resolve their own appeal.
    if (appeal.userId === session.user.id) {
      return NextResponse.json(
        { error: "An appeal cannot be resolved by the creator who filed it" },
        { status: 403 },
      );
    }

    const resolved = await prisma.moderationAppeal.update({
      where: { id: appealId },
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

    logger.info(`[moderation] appeal ${appealId} ${outcome} by ${session.user.id}`);

    return NextResponse.json({ success: true, appeal: resolved });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
