"use client";

/**
 * Dashboard Zustand store
 *
 * Responsibilities:
 *  - Hold earnings, clips, platforms stats, revenue trend, and recent projects
 *  - Cache API responses for CACHE_TTL_MS to avoid redundant fetches
 *  - Expose a single `fetchDashboard` action consumed by the thin hook layer
 *
 * Components should NOT import this store directly — use the
 * `useDashboardData` hook in app/hooks/useDashboardData.ts instead.
 * That keeps the component API stable if we ever swap the data source.
 */

import { create } from "zustand";
import type {
  DashboardState,
  DashboardActions,
  DashboardStats,
  RevenuePoint,
  Project,
} from "./types";

// ─── Cache TTL ────────────────────────────────────────────────────────────────

/** Re-use cached data for 5 minutes before hitting the API again */
const CACHE_TTL_MS = 5 * 60 * 1000;

// ─── Mock data (replace with real API call) ───────────────────────────────────

const MOCK_STATS: DashboardStats = {
  earnings: {
    total: "$12,450.80",
    trend: 12.5,
    trendLabel: "+12.5% from last month",
  },
  clips: {
    total: 142,
    trend: 8.2,
    trendLabel: "+8.2% from last month",
  },
  platforms: {
    total: 4,
    trend: 0,
    trendLabel: "Steady performance",
  },
};

const MOCK_REVENUE_TREND: RevenuePoint[] = [
  { date: "2024-03-01", amount: 400 },
  { date: "2024-03-05", amount: 600 },
  { date: "2024-03-10", amount: 800 },
  { date: "2024-03-15", amount: 700 },
  { date: "2024-03-20", amount: 900 },
  { date: "2024-03-25", amount: 1100 },
];

const MOCK_PROJECTS: Project[] = [
  {
    id: "1",
    title: "Apex Legends Clutch Breakdown and Post Match Analysis",
    clipsGenerated: 2,
    status: "processing",
    accent:
      "radial-gradient(circle at 30% 25%, rgba(127, 221, 255, 0.55), transparent 32%), linear-gradient(145deg, #0b2230 0%, #112839 45%, #061218 100%)",
  },
  {
    id: "2",
    title: "React Native Tutorial",
    clipsGenerated: 12,
    status: "completed",
    accent:
      "radial-gradient(circle at 50% 30%, rgba(170, 220, 206, 0.32), transparent 36%), linear-gradient(145deg, #536f66 0%, #62786f 48%, #241c19 100%)",
  },
];

// ─── Async fetcher (swap this for a real API call) ────────────────────────────

async function fetchDashboardFromAPI(): Promise<{
  stats: DashboardStats;
  revenueTrend: RevenuePoint[];
  recentProjects: Project[];
}> {
  // TODO: replace with `fetch('/api/dashboard')` when the endpoint is ready
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return {
    stats: MOCK_STATS,
    revenueTrend: MOCK_REVENUE_TREND,
    recentProjects: MOCK_PROJECTS,
  };
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: DashboardState = {
  stats: null,
  revenueTrend: [],
  recentProjects: [],
  lastFetchedAt: null,
  loading: false,
  error: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardState & DashboardActions>(
  (set, get) => ({
    ...initialState,

    fetchDashboard: async () => {
      const { loading, lastFetchedAt } = get();

      // Bail out if a fetch is already in-flight
      if (loading) return;

      // Serve from cache if data is still fresh
      if (lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS) {
        return;
      }

      set({ loading: true, error: null });

      try {
        const data = await fetchDashboardFromAPI();
        set({
          stats: data.stats,
          revenueTrend: data.revenueTrend,
          recentProjects: data.recentProjects,
          lastFetchedAt: Date.now(),
          loading: false,
          error: null,
        });
      } catch (err) {
        set({
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to fetch dashboard data",
        });
      }
    },

    invalidateCache: () => set({ lastFetchedAt: null }),

    setRecentProjects: (projects) => set({ recentProjects: projects }),
  })
);

// ─── Selectors (memoised slices — prevent unnecessary re-renders) ─────────────

/** Select only the stats slice */
export const selectStats = (s: DashboardState & DashboardActions) => s.stats;

/** Select only the revenue trend */
export const selectRevenueTrend = (s: DashboardState & DashboardActions) =>
  s.revenueTrend;

/** Select only recent projects */
export const selectRecentProjects = (s: DashboardState & DashboardActions) =>
  s.recentProjects;

/** Select loading + error meta */
export const selectDashboardMeta = (s: DashboardState & DashboardActions) => ({
  loading: s.loading,
  error: s.error,
  lastFetchedAt: s.lastFetchedAt,
});
