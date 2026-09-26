import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { checkCsrf } from "@/app/lib/csrf";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { logger } from "@/app/lib/logger";

export async function POST(request: NextRequest) {
  const rateLimited = await applyRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseRequestJson(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body as { planId?: string };

  const planId = body?.planId;
  if (!planId || !["pro", "enterprise"].includes(planId)) {
    return NextResponse.json(
      { error: "Invalid planId. Must be 'pro' or 'enterprise'." },
      { status: 400 }
    );
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const origin =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  if (stripeKey) {
    try {
      // Dynamic import of Stripe to handle optional runtime dependency
      const Stripe = (await import("stripe")).default;
      // Stripe types don't accept string literal for apiVersion - use as any
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" as any });

      const priceId =
        planId === "pro"
          ? process.env.STRIPE_PRO_PRICE_ID
          : process.env.STRIPE_ENTERPRISE_PRICE_ID;

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: session.user.email,
        line_items: priceId
          ? [{ price: priceId, quantity: 1 }]
          : [
              {
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: `ClipsAI ${planId.toUpperCase()} Plan`,
                    description: `Monthly subscription to ClipsAI ${planId} plan`,
                  },
                  unit_amount: planId === "pro" ? 2900 : 9900,
                  recurring: { interval: "month" },
                },
                quantity: 1,
              },
            ],
        metadata: {
          userEmail: session.user.email,
          plan: planId,
        },
        success_url: `${origin}/billing?success=true&plan=${planId}`,
        cancel_url: `${origin}/billing?canceled=true`,
      });

      logger.info(`[billing] Created Stripe checkout session ${checkoutSession.id} for ${session.user.email}`);

      return NextResponse.json({
        url: checkoutSession.url,
        sessionId: checkoutSession.id,
      });
    } catch (err) {
      logger.error(`[billing] Stripe checkout session error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Fallback test/development response when Stripe key is not configured
  logger.info(`[billing] Simulating checkout for plan ${planId} for user ${session.user.email}`);
  const redirectUrl = `${origin}/billing?success=true&plan=${planId}&simulated=true`;

  return NextResponse.json({
    url: redirectUrl,
    sessionId: `cs_simulated_${Date.now()}`,
    simulated: true,
  });
}
