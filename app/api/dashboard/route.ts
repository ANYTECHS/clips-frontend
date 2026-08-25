/**
 * GET /api/dashboard
 *
 * Returns aggregated dashboard data for the authenticated user including:
 * - stats: earnings, clips, and platforms metrics
 * - revenueTrend: historical revenue data points
 * - recentProjects: recently created projects with their status
 *
 * Uses auth() to get session; returns 401 if not authenticated.
 * Returns sensible zero-state for new users.
 *
 * Issue #889 – API versioning headers added.
 * Issue #890 – auth guard validates the session before any work is done.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { withVersioning } from "@/app/api/versioning";
import type {
  DashboardStats,
  RevenuePoint,
  Project,
} from "@/app/store/types";

export async function GET(request: NextRequest) {
  return withVersioning(request, async () => {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // TODO: Replace with actual database queries
    // For now, return zero-state data for new users
    const stats: DashboardStats = {
      earnings: {
        total: "$0.00",
        trend: 0,
        trendLabel: "No data yet",
      },
      clips: {
        total: 0,
        trend: 0,
        trendLabel: "No data yet",
      },
      platforms: {
        total: 0,
        trend: 0,
        trendLabel: "No data yet",
      },
    };

    const revenueTrend: RevenuePoint[] = [];

    const recentProjects: Project[] = [];

    const body = {
      data: {
        stats,
        revenueTrend,
        recentProjects,
      },
      error: null,
    };

    return NextResponse.json(body);
  });
}
