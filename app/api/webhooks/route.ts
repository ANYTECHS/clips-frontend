import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { applyCustomRateLimit } from "@/app/lib/customRateLimit";
import { withApiAnalytics } from "@/app/lib/withApiAnalytics";
import { createWebhookBodySchema } from "@/app/api/schemas/index";
import { webhookStore } from "@/app/lib/webhooks/webhookStore";
import type { WebhookEndpoint } from "@/app/lib/webhooks/types";
import { paginateItems, parsePaginationParams } from "@/app/api/pagination";

/** Never expose the signing secret after creation — only used to verify deliveries. */
function toPublicEndpoint(endpoint: WebhookEndpoint) {
  const { secret, ...publicEndpoint } = endpoint;
  void secret;
  return publicEndpoint;
}

async function handleGet(request: NextRequest) {
  const rateLimited = await applyCustomRateLimit(request, "/api/webhooks");
  if (rateLimited) return rateLimited;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const endpoints = webhookStore.listForUser(session.user.id).map(toPublicEndpoint);
  const { items, meta } = paginateItems(endpoints, parsePaginationParams(searchParams, 50));
  return NextResponse.json({ data: items, error: null, meta });
}

async function handlePost(request: NextRequest) {
  const rateLimited = await applyCustomRateLimit(request, "/api/webhooks");
  if (rateLimited) return rateLimited;

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseRequestJson(request);
  if (!parsed.ok) return parsed.response;

  const validation = createWebhookBodySchema.safeParse(parsed.body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: validation.error.issues },
      { status: 400 }
    );
  }

  const endpoint = webhookStore.create({
    userId: session.user.id,
    url: validation.data.url,
    events: validation.data.events,
  });

  // The signing secret is only ever returned here — store it now, it cannot
  // be retrieved again (only rotated by deleting and recreating the webhook).
  return NextResponse.json({ data: endpoint, error: null }, { status: 201 });
}

export const GET = withApiAnalytics("/api/webhooks", handleGet, async () => {
  const session = await auth();
  return session?.user?.id;
});

export const POST = withApiAnalytics("/api/webhooks", handlePost, async () => {
  const session = await auth();
  return session?.user?.id;
});
