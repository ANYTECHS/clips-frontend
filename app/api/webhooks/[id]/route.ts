import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  secret: z.string().min(16).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhook = await prisma.webhook.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({ webhook });
  } catch (error) {
    logger.error("Error fetching webhook:", error);
    return NextResponse.json({ error: "Failed to fetch webhook" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = updateWebhookSchema.parse(body);

    const webhook = await prisma.webhook.updateMany({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      data: validatedData,
    });

    if (webhook.count === 0) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const updatedWebhook = await prisma.webhook.findUnique({
      where: { id: params.id },
    });

    return NextResponse.json({ webhook: updatedWebhook });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    logger.error("Error updating webhook:", error);
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhook = await prisma.webhook.deleteMany({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (webhook.count === 0) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error deleting webhook:", error);
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}
