import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/app/lib/logger";
import { prisma } from "@/app/lib/prisma";
import { getAuthUserId } from "@/app/lib/getAuthUserId";

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

    // Verify endpoint ownership
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!endpoint) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const statusFilter = searchParams.get("status") || undefined;
    const skip = (page - 1) * limit;

    const whereClause: {
      endpointId: string;
      status?: string;
      isDeadLetter?: boolean;
    } = {
      endpointId: id,
    };

    if (statusFilter) {
      if (statusFilter === "dead_letter") {
        whereClause.isDeadLetter = true;
      } else {
        whereClause.status = statusFilter;
      }
    }

    const [total, deliveries] = await Promise.all([
      prisma.webhookDelivery.count({ where: whereClause }),
      prisma.webhookDelivery.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          endpointId: true,
          eventType: true,
          eventId: true,
          payload: true,
          attempt: true,
          status: true,
          statusCode: true,
          response: true,
          error: true,
          isDeadLetter: true,
          nextAttemptAt: true,
          attemptedAt: true,
          deliveredAt: true,
          createdAt: true,
          updatedAt: true,
          // Never expose endpoint secrets or sensitive headers
        },
      }),
    ]);

    // Format deliveries with clear state information
    const formattedDeliveries = deliveries.map((d) => {
      let state: "pending" | "delivered" | "retry_scheduled" | "failed" | "dead_letter" = "pending";
      if (d.isDeadLetter || d.status === "dead_letter") {
        state = "dead_letter";
      } else if (d.status === "delivered") {
        state = "delivered";
      } else if (d.nextAttemptAt && new Date(d.nextAttemptAt) > new Date()) {
        state = "retry_scheduled";
      } else if (d.status === "failed") {
        state = "failed";
      }

      return {
        ...d,
        deliveryState: state,
      };
    });

    return NextResponse.json({
      deliveries: formattedDeliveries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("[webhooks] Error fetching deliveries:", error);
    return NextResponse.json({ error: "Failed to fetch deliveries" }, { status: 500 });
  }
}
