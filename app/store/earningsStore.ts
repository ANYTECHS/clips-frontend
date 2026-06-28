"use client";

/**
 * Earnings Zustand store
 *
 * Owns the earnings-specific state: aggregated totals and a per-item breakdown.
 * The dashboard store holds a summary (DashboardStats.earnings) for the KPI
 * cards; this store holds the full breakdown for a dedicated Earnings page.
 *
 * Design decisions:
 * - 5-minute cache TTL — same policy as dashboardStore
 * - Single in-flight guard (no duplicate requests)
 * - Fine-grained selectors to prevent unnecessary re-renders
 *
 * Usage:
 * import { useEarningsStore, selectEarningsTotals } from "@/app/store";
 */

import { create } from "zustand";
import type {
  EarningsState,
  EarningsActions,
  EarningsBreakdownItem,
} from "./types";
import { useUserStore } from "./userStore";

// ─── Cache TTL ────────────────────────────────────────────────────────────────

import { EARNINGS_CACHE_TTL_MS } from "@/app/lib/constants";
/** Re-use cached data for a fixed lifespan before hitting the API again */
const CACHE_TTL_MS = EARNINGS_CACHE_TTL_MS;
export { EARNINGS_CACHE_TTL_MS };

import { fetchEarningsFromAPI } from "./api";

// ─── Initial state ────────────────────────────────────────────────────────────

/**
 * Initial standard fallback values for the earnings state slice.
 */
const initialState: EarningsState = {
  totalEarnings: "$0.00",
  totalTrend: 0,
  trendLabel: "",
  totalFiat: { value: "$0.00", change: 0 },
  cryptoRevenue: { value: "0.00 ETH", change: 0 },
  pendingPayouts: { value: "$0.00", change: 0 },
  breakdown: [],
  lastFetchedAt: null,
  loading: false,
  error: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Reactive state store container managing aggregated totals and detailed earnings item breakdowns.
 */
export const useEarningsStore = create<EarningsState & EarningsActions>(
  (set, get) => ({
    ...initialState,

    fetchEarnings: async () => {
      const { loading, lastFetchedAt } = get();

      if (loading) return;

      if (lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS) {
        return;
      }

      set({ loading: true, error: null });

      try {
        const data = await fetchEarningsFromAPI();
        set({
          totalEarnings: data.totalEarnings,
          totalTrend: data.totalTrend,
          trendLabel: data.trendLabel,
          totalFiat: data.totalFiat,
          cryptoRevenue: data.cryptoRevenue,
          pendingPayouts: data.pendingPayouts,
          breakdown: data.breakdown,
          lastFetchedAt: Date.now(),
          loading: false,
          error: null,
        });
      } catch (err) {
        set({
          loading: false,
          error:
            err instanceof Error ? err.message : "Failed to fetch earnings",
        });
      }
    },

    invalidateEarningsCache: () => set({ lastFetchedAt: null }),
  })
);

// ─── Subscribe to plan changes ─────────────────────────────────────────────────

if (typeof window !== "undefined") {
  useUserStore.getState().onPlanChange(() => {
    useEarningsStore.getState().invalidateEarningsCache();
  });
}

// ─── Selectors ────────────────────────────────────────────────────────────────

/**
 * Aggregated totals only — cheap subscription for summary cards.
 *
 * @param s - Combined global earnings store data slice object.
 * @returns Filtered metrics mapping tracking fiat, crypto, and pending balances.
 */
export const selectEarningsTotals = (s: EarningsState & EarningsActions) => ({
  totalEarnings: s.totalEarnings,
  totalTrend: s.totalTrend,
  trendLabel: s.trendLabel,
  totalFiat: s.totalFiat,
  cryptoRevenue: s.cryptoRevenue,
  pendingPayouts: s.pendingPayouts,
});

/**
 * Selects the full sequential itemization history of historical settlement events.
 *
 * @param s - Combined global earnings store data slice object.
 * @returns Array collection containing explicit categorical items.
 */
export const selectEarningsBreakdown = (s: EarningsState & EarningsActions) =>
  s.breakdown;

/**
 * Extracts store processing states alongside validation limits.
 *
 * @param s - Combined global earnings store data slice object.
 * @returns Consolidated runtime lifecycle metrics.
 */
export const selectEarningsMeta = (s: EarningsState & EarningsActions) => ({
  loading: s.loading,
  error: s.error,
  lastFetchedAt: s.lastFetchedAt,
});
