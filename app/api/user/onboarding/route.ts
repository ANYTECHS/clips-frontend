import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { logger } from "@/app/lib/logger";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { prisma } from "@/app/lib/prisma";

export const PostOnboardingSchema = z.object({
  step: z.number().min(0),
  data: z.record(z.unknown()),
});

export const OnboardingResponseSchema = z.object({
  success: z.boolean(),
});

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseRequestJson(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;

    const parsed = PostOnboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const { step, data } = parsed.data;

    await prisma.user.update({
      where: { email: session.user.email || "" },
      data: {
        onboardingStep: step,
        // Onboarding data types are dynamic - use as any
        onboardingData: data as any,
      },
    });

    logger.info(`[Onboarding] Saved step ${step} for user ${session.user.id}`, data);

    return NextResponse.json({ success: true, onboardingStep: step });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
