"use client";

/**
 * useDashboardData — thin hook over the Zustand dashboard store.
 *
 * Keeps the same return shape as before so every existing consumer
 * (RevenueTrendCard, RecentProjects, StatCardGroup) works without changes.
 *
 * The store handles:
 * - Deduplication: only one in-flight fetch at a time
 * - Caching: data is reused for 5 minutes before re-fetching
 * - Shared state: all components read from the same store instance
 */

import { useEffect } from "react";
import {
  useDashboardStore,
  selectStats,
  selectRevenueTrend,
  selectRecentProjects,
  selectDashboardMeta,
  type DashboardState,
  type DashboardActions,
} from "@/app/store";

export type {
  DashboardStats,
  RevenuePoint,
  Project,
} from "@/app/store";

export type { EarningsStats } from "@/app/store";

/**
 * Structural grouping of fetched dashboard analytical data models.
 */
export interface DashboardData {
  stats: import("@/app/store").DashboardStats;
  revenueTrend: import("@/app/store").RevenuePoint[];
  recentProjects: import("@/app/store").Project[];
}

/**
 * React hook exposing aggregated metrics, performance trends, and asynchronous request states.
 *
 * @returns Object context containing state indicators, processing flags, and structured payloads.
 */
export function useDashboardData(): {
  data: DashboardData | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
} {
  const fetchDashboard = useDashboardStore((s: DashboardState & DashboardActions) => s.fetchDashboard);
  const invalidateCache = useDashboardStore((s: DashboardState & DashboardActions) => s.invalidateCache);
  const stats = useDashboardStore(selectStats);
  const revenueTrend = useDashboardStore(selectRevenueTrend);
  const recentProjects = useDashboardStore(selectRecentProjects);
  const { loading, error } = useDashboardStore(selectDashboardMeta);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const data: DashboardData | null =
    stats !== null
      ? { stats, revenueTrend, recentProjects }
      : null;

  return {
    data,
    loading,
    error: error ? new Error(error) : null,
    retry: () => {
      invalidateCache();
      fetchDashboard();
    },
  };
}
