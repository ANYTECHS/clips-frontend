import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { prisma } from "@/app/lib/prisma";
import type { NotificationChannel, NotificationPreferences } from "@/app/lib/notificationDelivery";
import type { NotificationType } from "../notificationStore";

const TYPES: NotificationType[] = [
  "job_complete",
  "transform_complete",
  "mint_success",
  "earnings_received",
];
const CHANNELS: NotificationChannel[] = ["inApp", "email", "push"];

function defaults(): NotificationPreferences {
  return Object.fromEntries(
    TYPES.map((type) => [type, { inApp: true, email: false, push: false }]),
  ) as NotificationPreferences;
}

function normalize(value: unknown): NotificationPreferences {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result = defaults();
  for (const type of TYPES) {
    const typePreferences = source[type];
    if (!typePreferences || typeof typePreferences !== "object") continue;
    for (const channel of CHANNELS) {
      const enabled = (typePreferences as Record<string, unknown>)[channel];
      if (typeof enabled === "boolean") result[type]![channel] = enabled;
    }
  }
  return result;
}

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = await prisma.user.findUnique({
    where: { id: authResult.userId },
    select: { notificationPreferences: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ data: normalize(user.notificationPreferences), error: null });
}

export async function PATCH(request: NextRequest) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const parsedBody = await parseRequestJson(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body as { preferences?: unknown };
  if (!body.preferences || typeof body.preferences !== "object") {
    return NextResponse.json({ error: "preferences must be an object" }, { status: 400 });
  }
  const preferences = normalize(body.preferences);
  const user = await prisma.user.update({
    where: { id: authResult.userId },
    data: { notificationPreferences: preferences },
    select: { notificationPreferences: true },
  });
  return NextResponse.json({ data: normalize(user.notificationPreferences), error: null });
}
