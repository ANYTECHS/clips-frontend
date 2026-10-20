import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { getAuthUserId } from "@/app/lib/getAuthUserId";
import { redeliverWebhook } from "@/app/lib/webhooks/delivery";

export async function POST(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string; deliveryId: string }> }
) {
  try {
    const { id, deliveryId } = await segmentData.params;
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify endpoint ownership and delivery association
    const delivery = await prisma.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        endpointId: id,
        endpoint: {
          userId,
        },
      },
      include: {
        endpoint: true,
      },
    });

    if (!delivery) {
      return NextResponse.json(
        { error: "Delivery not found or does not belong to this endpoint" },
        { status: 404 }
      );
    }

    // Check if delivery is in an eligible failed or dead-letter state
    if (delivery.status === "delivered" && !delivery.isDeadLetter) {
      return NextResponse.json(
        { error: "Cannot redeliver a successfully delivered webhook" },
        { status: 400 }
      );
    }

    // Prevent simultaneous duplicate redelivery
    if (delivery.status === "pending") {
      return NextResponse.json(
        { error: "A delivery attempt is already in progress" },
        { status: 409 }
      );
    }

    // Perform redelivery
    const result = await redeliverWebhook(deliveryId, userId);
    if (!result.success && result.error && !result.error.startsWith("HTTP response")) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updated = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        endpointId: true,
        eventType: true,
        eventId: true,
        attempt: true,
        status: true,
        statusCode: true,
        isDeadLetter: true,
        nextAttemptAt: true,
        attemptedAt: true,
        deliveredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: "Redelivery initiated",
      delivery: updated,
    });
  } catch (error) {
    logger.error("[webhooks] Error triggering redelivery:", error);
    return NextResponse.json({ error: "Failed to redeliver webhook" }, { status: 500 });
  }
}
