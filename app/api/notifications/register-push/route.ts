import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { prisma } from "@/app/lib/prisma";

function isAllowedPushEndpoint(value: string): boolean {
  try {
    const endpoint = new URL(value);
    const host = endpoint.hostname.toLowerCase();
    const approvedProviders = [
      "fcm.googleapis.com",
      "push.services.mozilla.com",
      "push.apple.com",
      "notify.windows.com",
    ];
    return endpoint.protocol === "https:" && approvedProviders.some(
      (provider) => host === provider || host.endsWith(`.${provider}`),
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const parsedBody = await parseRequestJson(request);
  if (!parsedBody.ok) return parsedBody.response;

  const subscription = parsedBody.body as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  if (
    typeof subscription.endpoint !== "string" ||
    !isAllowedPushEndpoint(subscription.endpoint) ||
    typeof subscription.keys?.p256dh !== "string" ||
    typeof subscription.keys.auth !== "string"
  ) {
    return NextResponse.json({ error: "A valid Web Push subscription is required" }, { status: 400 });
  }

  const saved = await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId: authResult.userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      userId: authResult.userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    select: { id: true, createdAt: true },
  });
  return NextResponse.json({ data: saved, error: null }, { status: 201 });
}
