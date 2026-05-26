import type { DashboardStats, RevenuePoint, Project, UserProfile, EarningsBreakdownItem } from "./types";

const MOCK_STATS: DashboardStats = {
  earnings: { total: "$12,450.80", trend: 12.5, trendLabel: "+12.5% from last month" },
  clips: { total: 142, trend: 8.2, trendLabel: "+8.2% from last month" },
  platforms: { total: 4, trend: 0, trendLabel: "Steady performance" },
};

const MOCK_REVENUE_TREND: RevenuePoint[] = [
  { date: "2024-03-01", amount: 400 },
  { date: "2024-03-05", amount: 600 },
  { date: "2024-03-10", amount: 800 },
];

const MOCK_PROJECTS: Project[] = [
  { id: "1", title: "Apex Legends", clipsGenerated: 2, status: "processing", accent: "" },
];

export async function fetchDashboardFromAPI(): Promise<{
  stats: DashboardStats;
  revenueTrend: RevenuePoint[];
  recentProjects: Project[];
}> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return {
    stats: MOCK_STATS,
    revenueTrend: MOCK_REVENUE_TREND,
    recentProjects: MOCK_PROJECTS,
  };
}

const MOCK_PROFILE: UserProfile = {
  id: "usr_001",
  name: "Alex Rivera",
  email: "alex@clipcash.ai",
  avatarUrl: "/avatar.png",
  plan: "pro",
  planUsagePercent: 80,
};

export async function fetchUserFromAPI(): Promise<UserProfile> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return MOCK_PROFILE;
}

const MOCK_BREAKDOWN: EarningsBreakdownItem[] = [
  { id: "e1", label: "Apex", amount: 320.5, date: "2024-03-25", platform: "youtube" },
];

export async function fetchEarningsFromAPI(): Promise<{
  totalEarnings: string;
  totalTrend: number;
  trendLabel: string;
  totalFiat: { value: string; change: number };
  cryptoRevenue: { value: string; change: number };
  pendingPayouts: { value: string; change: number };
  breakdown: EarningsBreakdownItem[];
}> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    totalEarnings: "$12,450.80",
    totalTrend: 12.5,
    trendLabel: "+12.5% from last month",
    totalFiat: { value: "$12,450.80", change: 12.5 },
    cryptoRevenue: { value: "1.25 ETH", change: 8.2 },
    pendingPayouts: { value: "$1,850.25", change: 0 },
    breakdown: MOCK_BREAKDOWN,
  };
}
