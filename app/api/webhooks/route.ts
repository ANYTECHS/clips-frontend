import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { getAuthUserId } from "@/app/lib/getAuthUserId";
import { validateWebhookUrl } from "@/app/lib/webhooks/ssrf";
import { CANONICAL_WEBHOOK_EVENTS, WEBHOOK_EVENT_TYPES, normalizeWebhookEventType } from "@/app/lib/webhooks/types";

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1, "At least one event must be selected"),
  description: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhooks = await prisma.webhookEndpoint.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        url: true,
        events: true,
        active: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        // Omit secret to prevent disclosure in list responses
      },
    });

    return NextResponse.json({ webhooks });
  } catch (error) {
    logger.error("[webhooks] Error fetching webhooks:", error);
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { url, events, description } = parsed.data;

    // Validate destination URL scheme and SSRF protections
    const ssrfCheck = await validateWebhookUrl(url);
    if (!ssrfCheck.valid) {
      return NextResponse.json(
        { error: ssrfCheck.error || "Invalid destination URL" },
        { status: 400 }
      );
    }

    // Validate event subscriptions against allowlist
    const validEvents = new Set<string>(WEBHOOK_EVENT_TYPES);
    const normalizedEvents: string[] = [];

    for (const evt of events) {
      const canonical = normalizeWebhookEventType(evt);
      if (!validEvents.has(evt as any) && !validEvents.has(canonical as any)) {
        return NextResponse.json(
          {
            error: `Unsupported event type: ${evt}. Supported events are: ${CANONICAL_WEBHOOK_EVENTS.join(", ")}`,
          },
          { status: 400 }
        );
      }
      if (!normalizedEvents.includes(canonical)) {
        normalizedEvents.push(canonical);
      }
    }

    // Generate cryptographically secure secret
    const secret = `whsec_${crypto.randomBytes(32).toString("hex")}`;

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        userId,
        url: ssrfCheck.normalizedUrl || url,
        events: normalizedEvents,
        secret,
        description: description || null,
        active: true,
      },
    });

    // Return the created endpoint including the secret as a ONE-TIME display value
    return NextResponse.json(
      {
        webhook: {
          id: endpoint.id,
          userId: endpoint.userId,
          url: endpoint.url,
          events: endpoint.events,
          active: endpoint.active,
          description: endpoint.description,
          secret: endpoint.secret, // Only returned at creation time
          createdAt: endpoint.createdAt,
          updatedAt: endpoint.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("[webhooks] Error creating webhook:", error);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }
}
