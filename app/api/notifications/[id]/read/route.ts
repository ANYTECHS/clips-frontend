import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { checkCsrf } from "@/app/lib/csrf";
import { prisma } from "@/app/lib/prisma";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = checkCsrf(request);
    if (csrfError) return csrfError;
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Notification ID is required" },
        { status: 400 }
      );
    }

    await prisma.notification.updateMany({
      where: { id, userId: authResult.userId, readAt: null },
      data: { readAt: new Date() },
    });
    const updated = await prisma.notification.findFirst({
      where: { id, userId: authResult.userId },
    });

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
