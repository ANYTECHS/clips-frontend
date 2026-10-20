import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { prisma } from "@/app/lib/prisma";
import { sendNotification } from "@/app/lib/notifications";
import type { NotificationType } from "./notificationStore";
import { parsePaginationParams } from "../pagination";
import { paginationMeta } from "../types";

const NOTIFICATION_TYPES: NotificationType[] = [
  "job_complete",
  "transform_complete",
  "mint_success",
  "earnings_received",
];

const NOTIFICATION_TYPES: NotificationType[] = [
  "job_complete",
  "transform_complete",
  "mint_success",
  "earnings_received",
];

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;
    const params = parsePaginationParams(new URL(request.url).searchParams);
    const total = await prisma.notification.count({ where: { userId } });
    const page = Math.min(params.page, Math.max(1, Math.ceil(total / params.pageSize)));
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
      meta: paginationMeta({ page, pageSize: params.pageSize, total }),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const parsedBody = await parseRequestJson(request);
  if (!parsedBody.ok) return parsedBody.response;

  try {
    const { type, payload } = parsedBody.body as {
      type?: NotificationType;
      payload?: Record<string, unknown>;
    };

    if (!type || !NOTIFICATION_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: "A supported notification type is required" },
        { status: 400 }
      );
    }

    const result = await sendNotification(authResult.userId, type, payload ?? {});

    return NextResponse.json(
      { success: true, data: result.notification, delivered: result.delivered, failed: result.failed },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create notification" },
      { status: 500 }
    );
  }
}
