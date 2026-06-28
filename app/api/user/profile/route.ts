import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

export const UserProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
  plan: z.enum(["free", "pro", "enterprise"]),
  planUsagePercent: z.number().min(0).max(100),
});

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

    // TODO: Replace with actual database call
    const mockUser = {
      id: session.user.id || "test-user-id",
      name: session.user.name || "User",
      email: session.user.email || "",
      avatarUrl: session.user.image || "/avatar.png",
      plan: "pro" as const,
      planUsagePercent: 80,
    };

    return NextResponse.json(mockUser);
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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

    const parsed = PatchUserProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // TODO: Replace with actual database update
    const updatedUser = {
      id: session.user.id || "test-user-id",
      name: data.name || session.user.name || "User",
      email: session.user.email || "",
      avatarUrl: data.avatarUrl ?? session.user.image || "/avatar.png",
      plan: "pro" as const,
      planUsagePercent: 80,
    };

    return NextResponse.json(updatedUser);
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
