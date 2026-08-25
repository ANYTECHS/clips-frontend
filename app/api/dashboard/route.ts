import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { getDashboardDataServer } from "@/app/lib/dashboardService";
import type { ApiResponse } from "../types";
import type { DashboardStats, RevenuePoint, Project } from "@/app/store/types";

/**
 * GET /api/dashboard
 *
 * Returns aggregated dashboard data for the authenticated user including:
 * - stats: earnings, clips, and platforms metrics
 * - revenueTrend: historical revenue data points
 * - recentProjects: recently created projects with their status
 *
 * Authenticated; returns 401 if not logged in.
 * Returns sensible zero-state metrics for new users without data.
 */
export async function GET(request: NextRequest) {
  const rateLimited = await applyRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const data = await getDashboardDataServer();
  if ('error' in data) {
    return NextResponse.json({ error: data.error }, { status: 401 });
  }

  const body: ApiResponse<{
    stats: DashboardStats;
    revenueTrend: RevenuePoint[];
    recentProjects: Project[];
  }> = {
    data,
    error: null,
  };

  return NextResponse.json(body);
}
