import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { getAuthUserId } from "@/app/lib/getAuthUserId";
import { DEFAULT_USER_PREFERENCES, deepMerge } from "@/app/lib/userPreferences";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        notifications: { take: 50 },
        webhookEndpoints: {
          select: {
            id: true,
            url: true,
            events: true,
            active: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentPrefs = deepMerge(DEFAULT_USER_PREFERENCES, (user.preferences as any) || {});
    currentPrefs.privacy.dataExportStatus = "ready";
    currentPrefs.privacy.dataExportRequestedAt = new Date().toISOString();

    await prisma.user.update({
      where: { id: userId },
      data: { preferences: currentPrefs },
    });

    const exportData = {
      exportVersion: "1.0",
      generatedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        plan: user.plan,
        createdAt: user.createdAt,
      },
      preferences: currentPrefs,
      notifications: user.notifications,
      webhooks: user.webhookEndpoints,
    };

    return NextResponse.json({
      success: true,
      status: "ready",
      data: exportData,
      message: "Data export generated successfully",
    });
  } catch (error) {
    logger.error("[user/export-data] Error exporting data:", error);
    return NextResponse.json({ error: "Failed to generate data export" }, { status: 500 });
  }
}
