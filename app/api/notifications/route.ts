import { NextRequest, NextResponse } from "next/server";
import { notificationStore } from "./notificationStore";
import type { NotificationType } from "./notificationStore";
import { paginateItems, parsePaginationParams } from "../pagination";

const NOTIFICATION_TYPES: NotificationType[] = [
  "job_complete",
  "transform_complete",
  "mint_success",
  "earnings_received",
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default_user";

    const unread = await notificationStore.getUnread(userId);
    const { items: notifications, meta } = paginateItems(
      unread,
      parsePaginationParams(searchParams, 50)
    );

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount: unread.length,
      meta,
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
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: "A JSON object is required" },
        { status: 400 },
      );
    }

    const {
      userId = "default_user",
      type,
      title,
      message,
      payload,
    } = body as {
      userId?: string;
      type: NotificationType;
      title: string;
      message: string;
      payload?: Record<string, unknown>;
    };

    if (
      (typeof userId !== "string" || !userId.trim()) ||
      !NOTIFICATION_TYPES.includes(type) ||
      typeof title !== "string" || !title.trim() ||
      typeof message !== "string" || !message.trim() ||
      (payload !== undefined && (typeof payload !== "object" || payload === null || Array.isArray(payload)))
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid notification fields" },
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
