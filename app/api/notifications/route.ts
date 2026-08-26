import { NextRequest, NextResponse } from "next/server";
import { notificationStore } from "./notificationStore";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default_user";

    const notifications = await notificationStore.getUnread(userId);

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount: notifications.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}
