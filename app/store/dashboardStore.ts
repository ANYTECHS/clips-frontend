"use client";

/**
 * Dashboard Zustand store
 *
 * Responsibilities:
 * - Hold earnings, clips, platforms stats, revenue trend, and recent projects
 * - Cache API responses for CACHE_TTL_MS to avoid redundant fetches
 * - Expose a single `fetchDashboard` action consumed by the thin hook layer
 *
 * Components should NOT import this store directly — use the
 * `useDashboardData` hook in app/hooks/useDashboardData.ts instead.
 * That keeps the component API stable if we ever swap the data source.
 */

import { create } from "zustand";
import * as Sentry from "@sentry/nextjs";
import type {
  DashboardState,
  DashboardActions,
  DashboardStats,
  RevenuePoint,
  Project,
} from "./types";
import { useUserStore } from "./userStore";

// ─── Cache TTL ────────────────────────────────────────────────────────────────

import { DASHBOARD_CACHE_TTL_MS } from "@/app/lib/constants";
/** Re-use cached data for a fixed lifespan before hitting the API again */
const CACHE_TTL_MS = DASHBOARD_CACHE_TTL_MS;
export { DASHBOARD_CACHE_TTL_MS };

import { fetchDashboardFromAPI } from "./api";

// ─── Initial state ────────────────────────────────────────────────────────────

/**
 * Initial standard fallback values for the dashboard state slice.
 */
const initialState: DashboardState = {
  stats: null,
  revenueTrend: [],
  recentProjects: [],
  lastFetchedAt: null,
  loading: false,
  error: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Reactive state store container managing user analytics metrics and tracking trends.
 */
export const useDashboardStore = create<DashboardState & DashboardActions>(
  (set, get) => ({
    ...initialState,

    fetchDashboard: async () => {
      const { loading, lastFetchedAt } = get();

      if (loading) return;

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
        Sentry.captureException(err);
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

/**
 * Selects analytics aggregate values from the dashboard store instance.
 *
 * @param s - Combined global dashboard store data slice object.
 * @returns Parsed statistics metrics context or null.
 */
export const selectStats = (s: DashboardState & DashboardActions) => s.stats;

/**
 * Selects the timeline progression points plotting transaction metrics.
 *
 * @param s - Combined global dashboard store data slice object.
 * @returns Array collection tracking historical revenue trends.
 */
export const selectRevenueTrend = (s: DashboardState & DashboardActions) =>
  s.revenueTrend;

/**
 * Selects the historical project elements saved across localized domains.
 *
 * @param s - Combined global dashboard store data slice object.
 * @returns Array tracking structural context payloads representing recent items.
 */
export const selectRecentProjects = (s: DashboardState & DashboardActions) =>
  s.recentProjects;

/**
 * Extracts operation lifecycle timestamps and pending validation flags.
 *
 * @param s - Combined global dashboard store data slice object.
 * @returns Consolidated lifecycle tracking states.
 */
export const selectDashboardMeta = (s: DashboardState & DashboardActions) => ({
  loading: s.loading,
  error: s.error,
  lastFetchedAt: s.lastFetchedAt,
});

// ─── Subscribe to plan changes ─────────────────────────────────────────────────

if (typeof window !== "undefined") {
  useUserStore.getState().onPlanChange(() => {
    useDashboardStore.getState().invalidateCache();
  });
}
