/**
 * Jest mock for app/store/api.ts
 *
 * This mock is automatically used by Jest when tests import from ./api.
 * It provides predictable, deterministic data for testing without making real API calls.
 */

import type {
  DashboardStats,
  RevenuePoint,
  Project,
  UserProfile,
  EarningsBreakdownItem,
} from "../../../app/store/types";

export async function fetchDashboardFromAPI(): Promise<{
  stats: DashboardStats;
  revenueTrend: RevenuePoint[];
  recentProjects: Project[];
}> {
  return {
    stats: {
      earnings: {
        total: "$1,234.56",
        trend: 12.5,
        trendLabel: "up",
      },
      clips: {
        total: 42,
        trend: 8.3,
        trendLabel: "up",
      },
      platforms: {
        total: 3,
        trend: 0,
        trendLabel: "same",
      },
    },
    revenueTrend: [
      { date: "2024-01-01", amount: 100 },
      { date: "2024-01-02", amount: 150 },
      { date: "2024-01-03", amount: 200 },
    ],
    recentProjects: [
      {
        id: "mock-project-1",
        title: "Test Project 1",
        clipsGenerated: 10,
        status: "completed",
      },
      {
        id: "mock-project-2",
        title: "Test Project 2",
        clipsGenerated: 5,
        status: "processing",
      },
    ],
  };
}

export async function fetchUserFromAPI(): Promise<UserProfile> {
  return {
    id: "mock-user-123",
    name: "Test User",
    email: "test@example.com",
    avatarUrl: null,
    plan: "free",
    planUsagePercent: 25,
    transformQuotaRemaining: 10,
  };
}

export async function fetchEarningsFromAPI(): Promise<{
  totalEarnings: string;
  totalTrend: number;
  trendLabel: string;
  totalFiat: { value: string; change: number };
  cryptoRevenue: { value: string; change: number };
  pendingPayouts: { value: string; change: number };
  breakdown: EarningsBreakdownItem[];
}> {
  return {
    totalEarnings: "$1,234.56",
    totalTrend: 12.5,
    trendLabel: "up",
    totalFiat: { value: "$1,000.00", change: 10 },
    cryptoRevenue: { value: "50 XLM", change: 15 },
    pendingPayouts: { value: "$234.56", change: 5 },
    breakdown: [
      {
        id: "earnings-1",
        label: "TikTok",
        amount: 500,
        date: "2024-01-01",
        platform: "tiktok",
      },
      {
        id: "earnings-2",
        label: "Instagram",
        amount: 300,
        date: "2024-01-02",
        platform: "instagram",
      },
      {
        id: "earnings-3",
        label: "YouTube",
        amount: 434.56,
        date: "2024-01-03",
        platform: "youtube",
      },
    ],
  };
}
