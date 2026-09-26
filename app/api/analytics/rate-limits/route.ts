import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getRateLimitMonitoringSummary } from "@/app/lib/rateLimitMonitoring";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/rate-limits
 *
 * Rate limit monitoring dashboard data: request/limited counts by route and
 * by plan tier, plus the most recent limited requests. Requires an
 * authenticated session — this exposes cross-user request patterns.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(getRateLimitMonitoringSummary());
}
