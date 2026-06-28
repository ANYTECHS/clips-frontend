import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { logger } from "@/app/lib/logger";

export const PostOnboardingSchema = z.object({
  step: z.number().min(0),
  data: z.record(z.unknown()),
});

export const OnboardingResponseSchema = z.object({
  success: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = PostOnboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const { step, data } = parsed.data;

    // TODO: Replace with actual database update to save onboarding data
    logger.info(`[Onboarding] Saved step ${step} for user ${session.user.id}`, data);

    return NextResponse.json({ success: true, onboardingStep: step });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
