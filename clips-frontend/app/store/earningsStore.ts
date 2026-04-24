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

// ─── Mock data (replace with real API call) ───────────────────────────────────

const MOCK_BREAKDOWN: EarningsBreakdownItem[] = [
  { id: "e1", label: "Apex Legends Clutch Breakdown", amount: 320.5,  date: "2024-03-25", platform: "youtube"   },
  { id: "e2", label: "React Native Tutorial",         amount: 215.0,  date: "2024-03-24", platform: "tiktok"    },
  { id: "e3", label: "Valorant Highlights Reel",      amount: 180.75, date: "2024-03-22", platform: "instagram" },
  { id: "e4", label: "CS2 Pro Tips Series",           amount: 410.0,  date: "2024-03-20", platform: "youtube"   },
  { id: "e5", label: "Minecraft Build Timelapse",     amount: 95.55,  date: "2024-03-18", platform: "tiktok"    },
];

async function fetchEarningsFromAPI(): Promise<{
  totalEarnings: string;
  totalTrend: number;
  trendLabel: string;
  breakdown: EarningsBreakdownItem[];
}> {
  // TODO: replace with `fetch('/api/earnings')` when the endpoint is ready
  await new Promise((resolve) => setTimeout(resolve, 800));
  return {
    totalEarnings: "$12,450.80",
    totalTrend: 12.5,
    trendLabel: "+12.5% from last month",
    breakdown: MOCK_BREAKDOWN,
  };
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: EarningsState = {
  totalEarnings: "$0.00",
  totalTrend: 0,
  trendLabel: "",
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
