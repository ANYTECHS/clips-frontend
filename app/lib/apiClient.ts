import type {
  DashboardStats,
  RevenuePoint,
  Project,
  UserProfile,
  EarningsBreakdownItem,
} from "../store/types";
import { requestJson } from "./data-layer";

/**
 * Fetches the baseline analytics summary metrics and chronological data logs for the user workspace dashboard.
 *
 * @returns Resolves with a dataset enclosing stats, revenue points, and contextual historic items.
 * @throws {Error} Thrown if the server returns a non-2xx status code response.
 */
export async function fetchDashboardFromAPI(): Promise<{
  stats: DashboardStats;
  revenueTrend: RevenuePoint[];
  recentProjects: Project[];
}> {
  const json = await requestJson<{
    data?: {
      stats: DashboardStats;
      revenueTrend: RevenuePoint[];
      recentProjects: Project[];
    };
    stats?: DashboardStats;
    revenueTrend?: RevenuePoint[];
    recentProjects?: Project[];
  }>({
    url: "/api/dashboard",
    tags: ["dashboard"],
    persist: true,
  });
  if (json && json.data) {
    return json.data;
  }
  return json as {
    stats: DashboardStats;
    revenueTrend: RevenuePoint[];
    recentProjects: Project[];
  };
}

/**
 * Retrieves the core identity credential data block for the currently authenticated session.
 *
 * @returns Resolves with structural payload variables mapped to the current authenticated identity.
 * @throws {Error} Thrown if the secure network line encounters an outage or identity lookups fail.
 */
export async function fetchUserFromAPI(signal?: AbortSignal): Promise<UserProfile> {
  return requestJson<UserProfile>({
    url: "/api/user",
    tags: ["user"],
    persist: true,
    signal,
  });
}

/**
 * Compiles aggregated transactional payout statistics, ledger balance metrics, and historic breakdowns.
 *
 * @returns Resolves with localized fiat and cryptographic breakdown tracking reports.
 * @throws {Error} Thrown if internal reporting paths time out or return error blocks.
 */
export async function fetchEarningsFromAPI(): Promise<{
  totalEarnings: string;
  totalTrend: number;
  trendLabel: string;
  totalFiat: { value: string; change: number };
  cryptoRevenue: { value: string; change: number };
  pendingPayouts: { value: string; change: number };
  breakdown: EarningsBreakdownItem[];
}> {
  return requestJson({
    url: "/api/earnings",
    tags: ["earnings"],
    persist: true,
  });
}
