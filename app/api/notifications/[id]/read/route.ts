import { NextRequest, NextResponse } from "next/server";
import { notificationStore } from "../../notificationStore";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Notification ID is required" },
        { status: 400 }
      );
    }

    const updated = await notificationStore.markAsRead(id);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to mark notification as read" },
      { status: 500 }
    );
  }
}
