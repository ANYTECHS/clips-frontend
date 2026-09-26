/**
 * Content moderation submission and listing (Issue #1063).
 *
 * `POST` runs the automated check and records the decision. `GET` reads the
 * queue, which the review UI polls.
 *
 * Every outcome is written to `ModerationDecision` before it is returned, so
 * "what did we decide, when, and on what basis" is answerable later. A check
 * whose result is only ever returned to the caller leaves no record to audit
 * when a creator disputes it.
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
import { runModerationCheck } from "@/app/lib/moderation/provider";

export const SubmitModerationSchema = z.object({
  contentId: z.string().min(1),
  contentType: z.enum(["clip", "caption", "thumbnail"]).default("clip"),
  text: z.string().max(10_000).optional(),
  mediaUrl: z.string().url().optional(),
});

const ListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "flagged", "rejected"]).optional(),
  contentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseRequestJson(request);
    if (!parsedBody.ok) return parsedBody.response;

    const parsed = SubmitModerationSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 422 },
      );
    }

    const { contentId, contentType, text, mediaUrl } = parsed.data;

    const result = await runModerationCheck({ contentId, contentType, text, mediaUrl });

    const decision = await prisma.moderationDecision.create({
      data: {
        contentId,
        contentType,
        userId: session.user.id,
        status: result.status,
        categories: result.categories,
        score: result.score,
        source: "automated",
        provider: result.provider,
        reason: result.reason,
      },
    });

    logger.info(
      `[moderation] ${contentType} ${contentId} -> ${result.status} (${result.provider})`,
    );

    return NextResponse.json({ success: true, decision }, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = ListQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 422 },
      );
    }

    const { status, contentId, limit } = parsed.data;

    // Superseded decisions are history, not queue entries — a decision another
    // one replaces should not come back for review a second time.
    const superseded = await prisma.moderationDecision.findMany({
      where: { supersedesId: { not: null } },
      select: { supersedesId: true },
    });
    const supersededIds = superseded
      .map((row) => row.supersedesId)
      .filter((id): id is string => id !== null);

    const decisions = await prisma.moderationDecision.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(contentId ? { contentId } : {}),
        id: { notIn: supersededIds },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { appeals: true },
    });

    return NextResponse.json({ success: true, decisions });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
