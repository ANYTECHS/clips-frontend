"use client";

/**
 * Earnings Zustand store
 *
 * Owns the earnings-specific state: aggregated totals and a per-item breakdown.
 * The dashboard store holds a summary (DashboardStats.earnings) for the KPI
 * cards; this store holds the full breakdown for a dedicated Earnings page.
 *
 * Design decisions:
 *  - 5-minute cache TTL — same policy as dashboardStore
 *  - Single in-flight guard (no duplicate requests)
 *  - Fine-grained selectors to prevent unnecessary re-renders
 *
 * Usage:
 *   import { useEarningsStore, selectEarningsTotals } from "@/app/store";
 */

import { create } from "zustand";
import type {
  EarningsState,
  EarningsActions,
  EarningsBreakdownItem,
} from "./types";

// ─── Cache TTL ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;

import { fetchEarningsFromAPI } from "./api";

// ─── Initial state ────────────────────────────────────────────────────────────

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

export const useEarningsStore = create<EarningsState & EarningsActions>(
  (set, get) => ({
    ...initialState,

    fetchEarnings: async () => {
      const { loading, lastFetchedAt } = get();

      // Bail out if a fetch is already in-flight
      if (loading) return;

      // Serve from cache if data is still fresh
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

// ─── Selectors ────────────────────────────────────────────────────────────────

/** Aggregated totals only — cheap subscription for summary cards */
export const selectEarningsTotals = (s: EarningsState & EarningsActions) => ({
  totalEarnings: s.totalEarnings,
  totalTrend: s.totalTrend,
  trendLabel: s.trendLabel,
  totalFiat: s.totalFiat,
  cryptoRevenue: s.cryptoRevenue,
  pendingPayouts: s.pendingPayouts,
});

/** Full breakdown list */
export const selectEarningsBreakdown = (s: EarningsState & EarningsActions) =>
  s.breakdown;

/** Loading + error meta */
export const selectEarningsMeta = (s: EarningsState & EarningsActions) => ({
  loading: s.loading,
  error: s.error,
  lastFetchedAt: s.lastFetchedAt,
});
