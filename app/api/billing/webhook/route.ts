import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { logger } from "@/app/lib/logger";

function getQuotaLimit(plan: string): number {
  switch (plan.toLowerCase()) {
    case "pro":
      return 100;
    case "enterprise":
      return 1000;
    default:
      return 10;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    let event: any;

    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    let userEmail: string | undefined;
    let targetPlan: "free" | "pro" | "enterprise" = "pro";

    // Handle standard Stripe webhook events or custom test payloads
    if (event.type === "checkout.session.completed" || event.type === "customer.subscription.updated") {
      const sessionObj = event.data?.object ?? {};
      userEmail = sessionObj.customer_email || sessionObj.metadata?.userEmail;
      // Stripe metadata types are unknown - use as any
      targetPlan = (sessionObj.metadata?.plan as any) || "pro";
    } else if (event.userEmail || event.email) {
      userEmail = event.userEmail || event.email;
      // Custom webhook payload types are unknown - use as any
      targetPlan = (event.plan as any) || "pro";
    } else if (event.event === "payment_success" && event.userId) {
      const userById = await prisma.user.findUnique({ where: { id: event.userId } });
      if (userById) {
        userEmail = userById.email;
        // Custom webhook payload types are unknown - use as any
        targetPlan = (event.plan as any) || "pro";
      }
    }

    if (!userEmail) {
      logger.warn("[billing/webhook] Webhook received but no target user identifier found in event payload");
      return NextResponse.json({ received: true, updated: false, reason: "No user identifier in payload" });
    }

    const quotaLimit = getQuotaLimit(targetPlan);

    // Update user in database on payment success
    const updatedUser = await prisma.user.update({
      where: { email: userEmail },
      data: {
        plan: targetPlan,
        planUsagePercent: 0, // Reset usage on payment success / upgrade
      },
    });

    logger.info(`[billing/webhook] Updated user ${userEmail} plan to ${targetPlan}`);

    const transformQuotaRemaining = quotaLimit;

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        plan: updatedUser.plan,
        planUsagePercent: updatedUser.planUsagePercent,
        transformQuotaRemaining,
      },
      transformQuotaRemaining,
    });
  } catch (err) {
    logger.error(`[billing/webhook] Webhook processing error: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
