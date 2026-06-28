import {
  MOCK_DASHBOARD_STATS,
  MOCK_REVENUE_TREND,
  MOCK_PROJECTS,
  MOCK_USER_PROFILE,
  MOCK_EARNINGS_BREAKDOWN,
} from "../../../__mocks__/data";

export async function fetchDashboardFromAPI() {
  return {
    stats: MOCK_DASHBOARD_STATS,
    revenueTrend: MOCK_REVENUE_TREND,
    recentProjects: MOCK_PROJECTS,
  };
}

export async function fetchUserFromAPI() {
  return MOCK_USER_PROFILE;
}

export async function fetchEarningsFromAPI() {
  return {
    totalEarnings: MOCK_DASHBOARD_STATS.earnings.total,
    totalTrend: MOCK_DASHBOARD_STATS.earnings.trend,
    trendLabel: MOCK_DASHBOARD_STATS.earnings.trendLabel,
    totalFiat: { value: MOCK_DASHBOARD_STATS.earnings.total, change: MOCK_DASHBOARD_STATS.earnings.trend },
    cryptoRevenue: { value: "1.25 ETH", change: 8.2 },
    pendingPayouts: { value: "$1,850.25", change: 0 },
    breakdown: MOCK_EARNINGS_BREAKDOWN,
  };
}
