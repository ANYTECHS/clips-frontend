import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { getEndpointRateLimit } from "@/app/lib/endpointRateLimits";
import { compressResponse } from "@/app/lib/apiCompression";
import { earningsStore } from "@/app/api/earnings/earningsStore";
import { projectsStore } from "@/app/api/projects/projectsStore";
import { clipsStore } from "@/app/api/clips/clipsStore";
import type { ApiResponse } from "../types";
import type {
  DashboardStats,
  EarningsStats,
  ClipsStats,
  PlatformsStats,
  RevenuePoint,
  Project,
} from "@/app/store/types";

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
  const rateLimited = await applyRateLimit(request, getEndpointRateLimit("/api/dashboard"));
  if (rateLimited) return rateLimited;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const session = await auth();
  const sessionUser = session?.user as { provider?: string } | undefined;

  // 1. Calculate Earnings stats & Revenue trend
  const allTransactions = earningsStore.getTransactions(userId);
  const completedTransactions = allTransactions.filter((tx) => tx.status === "completed");

  const totalEarningsNum = completedTransactions.reduce((acc, tx) => acc + tx.amount, 0);

  const now = new Date();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const currentStart = new Date(now.getTime() - thirtyDaysMs).toISOString().split("T")[0];
  const priorStart = new Date(now.getTime() - 2 * thirtyDaysMs).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const currentEarningsTxs = completedTransactions.filter(
    (tx) => tx.date >= currentStart && tx.date <= today
  );
  const priorEarningsTxs = completedTransactions.filter(
    (tx) => tx.date >= priorStart && tx.date < currentStart
  );

  const currentEarningsSum = currentEarningsTxs.reduce((acc, tx) => acc + tx.amount, 0);
  const priorEarningsSum = priorEarningsTxs.reduce((acc, tx) => acc + tx.amount, 0);

  let earningsTrend = 0;
  let earningsTrendLabel = "No data yet";

  if (priorEarningsSum === 0) {
    if (currentEarningsSum > 0) {
      earningsTrend = 100;
      earningsTrendLabel = "+100.0% from last month";
    } else if (totalEarningsNum > 0) {
      earningsTrendLabel = "Steady performance";
    }
  } else {
    const pct = ((currentEarningsSum - priorEarningsSum) / priorEarningsSum) * 100;
    earningsTrend = Math.round(pct * 10) / 10;
    earningsTrendLabel = `${earningsTrend >= 0 ? "+" : ""}${earningsTrend.toFixed(1)}% from last month`;
  }

  const earningsStats: EarningsStats = {
    total: `$${totalEarningsNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    trend: earningsTrend,
    trendLabel: earningsTrendLabel,
  };

  // Group completed transactions into revenue trend data points
  const revenueDateMap = new Map<string, number>();
  completedTransactions.forEach((tx) => {
    revenueDateMap.set(tx.date, (revenueDateMap.get(tx.date) ?? 0) + tx.amount);
  });

  const revenueTrend: RevenuePoint[] = Array.from(revenueDateMap.entries())
    .map(([date, amount]) => ({ date, amount: parseFloat(amount.toFixed(2)) }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 2. Calculate Clips stats & Recent Projects
  const userProjects = projectsStore.getProjectsForUser(userId);
  clipsStore.getClipsForUser(userId);
  const totalClipsNum = userProjects.reduce(
    (acc, p) => acc + clipsStore.getClipsForProject(userId, p.id).length,
    0,
  );

  const currentPeriodProjects = userProjects.filter(
    (p) => new Date(p.createdAt).getTime() >= now.getTime() - thirtyDaysMs,
  );
  const priorPeriodProjects = userProjects.filter((p) => {
    const t = new Date(p.createdAt).getTime();
    return t >= now.getTime() - 2 * thirtyDaysMs && t < now.getTime() - thirtyDaysMs;
  });

  const currentClipsSum = currentPeriodProjects.reduce(
    (acc, p) => acc + clipsStore.getClipsForProject(userId, p.id).length,
    0,
  );
  const priorClipsSum = priorPeriodProjects.reduce(
    (acc, p) => acc + clipsStore.getClipsForProject(userId, p.id).length,
    0,
  );

  let clipsTrend = 0;
  let clipsTrendLabel = "No data yet";

  if (priorClipsSum === 0) {
    if (currentClipsSum > 0) {
      clipsTrend = 100;
      clipsTrendLabel = "+100.0% from last month";
    } else if (totalClipsNum > 0) {
      clipsTrendLabel = "Steady performance";
    }
  } else {
    const pct = ((currentClipsSum - priorClipsSum) / priorClipsSum) * 100;
    clipsTrend = Math.round(pct * 10) / 10;
    clipsTrendLabel = `${clipsTrend >= 0 ? "+" : ""}${clipsTrend.toFixed(1)}% from last month`;
  }

  const clipsStats: ClipsStats = {
    total: totalClipsNum,
    trend: clipsTrend,
    trendLabel: clipsTrendLabel,
  };

  const recentProjects: Project[] = userProjects.slice(0, 6).map((project) => {
    const clipCount = clipsStore.getClipsForProject(userId, project.id).length;
    return {
      id: project.id,
      title: project.name,
      clipsGenerated: clipCount,
      status: clipCount > 0 ? "completed" : "processing",
      image: project.thumbnailUrl,
      accent: "",
    };
  });

  // 3. Calculate Platform Connection stats
  const connectedPlatforms = new Set<string>();
  allTransactions.forEach((tx) => {
    if (tx.platform) {
      connectedPlatforms.add(tx.platform.toLowerCase());
    }
  });
  if (sessionUser?.provider) {
    connectedPlatforms.add(sessionUser.provider.toLowerCase());
  }

  const totalPlatforms = connectedPlatforms.size;

  const platformsStats: PlatformsStats = {
    total: totalPlatforms,
    trend: 0,
    trendLabel: totalPlatforms > 0 ? "Active connections" : "No platforms linked",
  };

  // 4. Construct response payload
  const stats: DashboardStats = {
    earnings: earningsStats,
    clips: clipsStats,
    platforms: platformsStats,
  };

  const body: ApiResponse<{
    stats: DashboardStats;
    revenueTrend: RevenuePoint[];
    recentProjects: Project[];
  }> = {
    data: {
      stats,
      revenueTrend,
      recentProjects,
    },
    error: null,
  };

  return compressResponse(request, NextResponse.json(body));
}
