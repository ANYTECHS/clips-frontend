import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { getAuthUserId } from "@/app/lib/getAuthUserId";
import {
  DEFAULT_USER_PREFERENCES,
  UserPreferencesSchema,
  deepMerge,
  type UserPreferences,
} from "@/app/lib/userPreferences";

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rawPreferences = (user.preferences as Partial<UserPreferences>) || {};
    const mergedPreferences = deepMerge(DEFAULT_USER_PREFERENCES, rawPreferences);

    // Sync user.name and user.avatarUrl with profile preference
    if (user.name && !mergedPreferences.profile.displayName) {
      mergedPreferences.profile.displayName = user.name;
    }
    if (user.avatarUrl && !mergedPreferences.profile.avatarUrl) {
      mergedPreferences.profile.avatarUrl = user.avatarUrl;
    }

    return NextResponse.json({
      preferences: mergedPreferences,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailVerified: true, // Email is immutable / verified once created
      },
    });
  } catch (error) {
    logger.error("[user/preferences] Error getting preferences:", error);
    return NextResponse.json({ error: "Failed to fetch user preferences" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = UserPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentPreferences = deepMerge(
      DEFAULT_USER_PREFERENCES,
      (user.preferences as Partial<UserPreferences>) || {}
    );

    const updatedPreferences = deepMerge(currentPreferences, parsed.data as any);

    // Prepare database update
    const userUpdateData: {
      preferences: any;
      name?: string;
      avatarUrl?: string | null;
    } = {
      preferences: updatedPreferences,
    };

    if (parsed.data.profile?.displayName !== undefined) {
      userUpdateData.name = parsed.data.profile.displayName;
    }
    if (parsed.data.profile?.avatarUrl !== undefined) {
      userUpdateData.avatarUrl = parsed.data.profile.avatarUrl;
    }

    await prisma.user.update({
      where: { id: userId },
      data: userUpdateData,
    });

    return NextResponse.json({
      preferences: updatedPreferences,
    });
  } catch (error) {
    logger.error("[user/preferences] Error updating preferences:", error);
    return NextResponse.json({ error: "Failed to update user preferences" }, { status: 500 });
  }
}
