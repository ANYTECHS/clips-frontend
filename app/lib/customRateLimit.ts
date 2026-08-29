/**
 * Drop-in replacement for applyRateLimit() that layers user/plan-based
 * customization (app/lib/rateLimitTiers.ts) and monitoring
 * (app/lib/rateLimitMonitoring.ts) on top of the base per-endpoint config
 * (app/lib/endpointRateLimits.ts).
 *
 * @example
 * export async function POST(req: NextRequest) {
 *   const limited = await applyCustomRateLimit(req, "/api/upload");
 *   if (limited) return limited;
 *   // ...
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { applyRateLimit, getRateLimitHeaders } from "@/app/lib/serverRateLimit";
import { getEndpointRateLimit } from "@/app/lib/endpointRateLimits";
import { getEffectiveRateLimit, type PlanTier } from "@/app/lib/rateLimitTiers";
import { recordRateLimitEvent } from "@/app/lib/rateLimitMonitoring";

async function resolveUserAndPlan(): Promise<{ userId?: string; plan?: PlanTier }> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return {};

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    return { userId, plan: (user?.plan as PlanTier) ?? "free" };
  } catch {
    // Unauthenticated or lookup failure — fall back to IP-based base limits.
    return {};
  }
}

export async function applyCustomRateLimit(
  request: NextRequest,
  route: string
): Promise<NextResponse | null> {
  const base = getEndpointRateLimit(route);
  const { userId, plan } = await resolveUserAndPlan();
  const effective = getEffectiveRateLimit(base, userId, plan);

  // Per-user requests are keyed by user id (not IP) so the customized limit
  // applies to that user everywhere, including behind a shared/NAT'd IP.
  const key = userId ? `user:${userId}:${route}` : undefined;

  const limitOptions = { limit: effective.limit, windowMs: effective.windowMs, key };
  const limited = await applyRateLimit(request, limitOptions);
  const headers = limited ? null : await getRateLimitHeaders(request, limitOptions);

  recordRateLimitEvent({
    route,
    userId,
    plan,
    limit: effective.limit,
    remaining: limited ? 0 : Number(headers?.["X-RateLimit-Remaining"] ?? effective.limit),
    limited: !!limited,
    timestamp: Date.now(),
  });

  return limited;
}
