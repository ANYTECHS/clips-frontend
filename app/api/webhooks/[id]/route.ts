import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { applyCustomRateLimit } from "@/app/lib/customRateLimit";
import { updateWebhookBodySchema } from "@/app/api/schemas/index";
import { webhookStore } from "@/app/lib/webhooks/webhookStore";
import type { WebhookEndpoint } from "@/app/lib/webhooks/types";

const WEBHOOK_ID_RE = /^wh_[a-zA-Z0-9-]{1,64}$/;

function validateWebhookId(id: string): NextResponse | null {
  if (!WEBHOOK_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid webhook id format" }, { status: 400 });
  }
  return null;
}

function toPublicEndpoint(endpoint: WebhookEndpoint) {
  const { secret: _secret, ...publicEndpoint } = endpoint;
  return publicEndpoint;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rateLimited = await applyCustomRateLimit(request, "/api/webhooks/[id]");
  if (rateLimited) return rateLimited;

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const idError = validateWebhookId(id);
  if (idError) return idError;

  const parsed = await parseRequestJson(request);
  if (!parsed.ok) return parsed.response;

  const validation = updateWebhookBodySchema.safeParse(parsed.body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: validation.error.issues },
      { status: 400 }
    );
  }

  const updated = webhookStore.update(id, session.user.id, validation.data);
  if (!updated) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  return NextResponse.json({ data: toPublicEndpoint(updated), error: null });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rateLimited = await applyCustomRateLimit(request, "/api/webhooks/[id]");
  if (rateLimited) return rateLimited;

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const idError = validateWebhookId(id);
  if (idError) return idError;

  const removed = webhookStore.remove(id, session.user.id);
  if (!removed) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id }, error: null });
}
