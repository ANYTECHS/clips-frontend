import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";

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
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ deliveries });
  } catch (error) {
    logger.error("Error fetching webhook deliveries:", error);
    return NextResponse.json({ error: "Failed to fetch deliveries" }, { status: 500 });
  }
}
