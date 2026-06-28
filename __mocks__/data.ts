import type {
  DashboardStats,
  RevenuePoint,
  Project,
  UserProfile,
  EarningsBreakdownItem,
} from "../app/store/types";

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  earnings: { total: "$12,450.80", trend: 12.5, trendLabel: "+12.5% from last month" },
  clips: { total: 142, trend: 8.2, trendLabel: "+8.2% from last month" },
  platforms: { total: 4, trend: 0, trendLabel: "Steady performance" },
};

export const MOCK_REVENUE_TREND: RevenuePoint[] = [
  { date: "2024-03-01", amount: 400 },
  { date: "2024-03-05", amount: 600 },
  { date: "2024-03-10", amount: 800 },
];

export const MOCK_PROJECTS: Project[] = [
  { id: "1", title: "Apex Legends", clipsGenerated: 2, status: "processing", accent: "" },
];

export const MOCK_USER_PROFILE: UserProfile = {
  id: "usr_001",
  name: "Alex Rivera",
  email: "alex@clipcash.ai",
  avatarUrl: "/avatar.png",
  plan: "pro",
  planUsagePercent: 80,
};

export const MOCK_EARNINGS_BREAKDOWN: EarningsBreakdownItem[] = [
  { id: "e1", label: "Apex", amount: 320.5, date: "2024-03-25", platform: "youtube" },
];
