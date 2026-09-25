/**
 * Manual review of a moderation decision (Issue #1063).
 *
 * A reviewer never edits the original row. The decision they make is appended
 * as a new record pointing at the one it replaces via `supersedesId`, so the
 * trail shows what the automated check said, what the human said, and in which
 * order. An audit that can be rewritten is not an audit.
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

export const ReviewSchema = z.object({
  /** The reviewer's verdict. `pending` is not a decision a human can make. */
  status: z.enum(["approved", "rejected"]),
  /** Why — shown to the creator, so it is required rather than optional. */
  reason: z.string().min(1).max(2_000),
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

    const parsed = ReviewSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 422 },
      );
    }

    const original = await prisma.moderationDecision.findUnique({ where: { id } });
    if (!original) {
      return NextResponse.json({ error: "Decision not found" }, { status: 404 });
    }

    const alreadyReviewed = await prisma.moderationDecision.findFirst({
      where: { supersedesId: id },
    });
    if (alreadyReviewed) {
      return NextResponse.json(
        { error: "This decision has already been reviewed" },
        { status: 409 },
      );
    }

    const decision = await prisma.moderationDecision.create({
      data: {
        contentId: original.contentId,
        contentType: original.contentType,
        userId: original.userId,
        status: parsed.data.status,
        // A human decision carries no model confidence; recording a score here
        // would imply one existed.
        categories: original.categories ?? undefined,
        score: null,
        source: "manual",
        provider: null,
        reason: parsed.data.reason,
        reviewerId: session.user.id,
        supersedesId: id,
      },
    });

    logger.info(
      `[moderation] ${original.contentId} reviewed by ${session.user.id}: ${parsed.data.status}`,
    );

    return NextResponse.json({ success: true, decision }, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
