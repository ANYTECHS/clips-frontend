/**
 * Shared types for the earnings API.
 * Imported by the route handler and by the earnings page.
 */

export interface EarningTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  cryptoAmount?: number;
  cryptoCurrency?: "ETH" | "SOL" | "USDC";
  platform: "YouTube" | "TikTok" | "Instagram" | "Twitch";
  type: "payout" | "royalty" | "mint" | "referral";
  status: "completed" | "pending" | "failed";
  taxId: string;
}

export interface EarningsSummary {
  total: string;
  completed: string;
  pending: string;
}

/**
 * Trend data comparing the current period against the previous one.
 * `value` is the percentage change (positive = growth, negative = decline).
 * `label` is the pre-formatted string shown in the UI (e.g. "+12.5%").
 */
export interface EarningsTrend {
  totalTrend: { value: number; label: string };
  completedTrend: { value: number; label: string };
}

export interface EarningsPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface EarningsResponse {
  transactions: EarningTransaction[];
  summary: EarningsSummary;
  trends: EarningsTrend;
  /** True when at least one completed transaction exists in the full dataset. */
  taxReady: boolean;
  pagination: EarningsPagination;
}
