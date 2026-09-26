import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { prisma } from "@/app/lib/prisma";

export const UserProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
  plan: z.enum(["free", "pro", "enterprise"]),
  planUsagePercent: z.number().min(0).max(100),
  transformQuotaRemaining: z.number().optional(),
});

function getQuotaRemaining(plan: string, usagePercent: number): number {
  const limits: Record<string, number> = { free: 10, pro: 100, enterprise: 1000 };
  const limit = limits[plan] ?? 10;
  return Math.max(0, limit - Math.round((usagePercent / 100) * limit));
}

export const PatchUserProfileSchema = z.object({
  name: z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email || "" },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const plan = user.plan as "free" | "pro" | "enterprise";
    const transformQuotaRemaining = getQuotaRemaining(plan, user.planUsagePercent);

    return NextResponse.json({
      id: user.id,
      name: user.name || "User",
      email: user.email,
      avatarUrl: user.avatarUrl,
      plan,
      planUsagePercent: user.planUsagePercent,
      transformQuotaRemaining,
    });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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

    const parsed = PatchUserProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const data = parsed.data;

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email || "" },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
    });

    const plan = updatedUser.plan as "free" | "pro" | "enterprise";
    const transformQuotaRemaining = getQuotaRemaining(plan, updatedUser.planUsagePercent);

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name || "User",
      email: updatedUser.email,
      avatarUrl: updatedUser.avatarUrl,
      plan,
      planUsagePercent: updatedUser.planUsagePercent,
      transformQuotaRemaining,
    });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
