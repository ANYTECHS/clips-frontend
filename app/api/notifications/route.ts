import { NextRequest, NextResponse } from "next/server";
import { notificationStore } from "./notificationStore";
import type { NotificationType } from "./notificationStore";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId = "default_user", type, title, message, payload } = body as {
      userId?: string;
      type: NotificationType;
      title: string;
      message: string;
      payload?: Record<string, unknown>;
    };

    if (!type || !title || !message) {
      return NextResponse.json(
        { success: false, error: "type, title, and message are required" },
        { status: 400 }
      );
    }

    const notification = await notificationStore.add(userId, type, title, message, payload);

    return NextResponse.json({ success: true, data: notification }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create notification" },
      { status: 500 }
    );
  }
}
