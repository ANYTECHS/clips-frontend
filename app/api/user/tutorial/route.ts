/**
 * Tutorial progress persistence (Issue #1065).
 *
 * Stored inside the existing `onboardingData` JSON column under a `tutorial`
 * key rather than in new columns: progress is a small, entirely client-driven
 * blob with no queries run against it, so a column per tour would be schema
 * churn for nothing.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { authOptions } from "@/app/lib/auth";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { prisma } from "@/app/lib/prisma";
import { EMPTY_PROGRESS } from "@/app/lib/tutorial/types";

const TourIdSchema = z.enum(["dashboard", "create-clip", "earnings"]);

export const TutorialProgressSchema = z.object({
  completed: z.array(TourIdSchema).max(20).default([]),
  skipped: z.array(TourIdSchema).max(20).default([]),
  // Bounded so a client cannot grow the JSON column without limit.
  dismissedTips: z.array(z.string().max(100)).max(200).default([]),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { onboardingData: true },
    });

    const stored = (user?.onboardingData as Record<string, unknown> | null)?.tutorial;
    const parsed = TutorialProgressSchema.safeParse(stored);

    return NextResponse.json({
      success: true,
      // A malformed stored blob reads as "no progress" rather than failing the
      // request — the worst case is a user seeing a tour again.
      progress: parsed.success ? parsed.data : EMPTY_PROGRESS,
    });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseRequestJson(request);
    if (!parsedBody.ok) return parsedBody.response;

    const parsed = TutorialProgressSchema.safeParse(parsedBody.body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 422 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { onboardingData: true },
    });

    // Merge rather than replace: `onboardingData` also holds the account-setup
    // wizard's answers, and overwriting it here would erase them.
    const existing = (user?.onboardingData as Record<string, unknown> | null) ?? {};

    await prisma.user.update({
      where: { email: session.user.email },
      data: { onboardingData: { ...existing, tutorial: parsed.data } },
    });

    return NextResponse.json({ success: true, progress: parsed.data });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
