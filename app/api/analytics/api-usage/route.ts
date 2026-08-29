import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getApiAnalyticsSummary } from "@/app/lib/apiAnalytics";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/api-usage
 *
 * Aggregated API usage/monitoring dashboard data: per-endpoint analytics,
 * per-user analytics, and overall performance (latency percentiles).
 * Requires an authenticated session — this exposes cross-user request
 * patterns and should not be public.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(getApiAnalyticsSummary());
}
