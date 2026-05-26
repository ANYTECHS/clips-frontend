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

import { fetchDashboardFromAPI } from "./api";

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
