import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { getAuthUserId } from "@/app/lib/getAuthUserId";
import { validateWebhookUrl } from "@/app/lib/webhooks/ssrf";
import { CANONICAL_WEBHOOK_EVENTS, WEBHOOK_EVENT_TYPES, normalizeWebhookEventType } from "@/app/lib/webhooks/types";

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhook = await prisma.webhookEndpoint.findFirst({
      where: {
        id,
        userId,
      },
      select: {
        id: true,
        userId: true,
        url: true,
        events: true,
        active: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({ webhook });
  } catch (error) {
    logger.error("[webhooks] Error fetching webhook:", error);
    return NextResponse.json({ error: "Failed to fetch webhook" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const updateData: {
      url?: string;
      events?: string[];
      description?: string;
      active?: boolean;
    } = {};

    if (parsed.data.url !== undefined) {
      const ssrfCheck = await validateWebhookUrl(parsed.data.url);
      if (!ssrfCheck.valid) {
        return NextResponse.json(
          { error: ssrfCheck.error || "Invalid destination URL" },
          { status: 400 }
        );
      }
      updateData.url = ssrfCheck.normalizedUrl || parsed.data.url;
    }

    if (parsed.data.events !== undefined) {
      const validEvents = new Set<string>(WEBHOOK_EVENT_TYPES);
      const normalizedEvents: string[] = [];

      for (const evt of parsed.data.events) {
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
      updateData.events = normalizedEvents;
    }

    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description;
    }

    if (parsed.data.active !== undefined) {
      updateData.active = parsed.data.active;
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        userId: true,
        url: true,
        events: true,
        active: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ webhook: updated });
  } catch (error) {
    logger.error("[webhooks] Error updating webhook:", error);
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    await prisma.webhookEndpoint.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[webhooks] Error deleting webhook:", error);
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}
