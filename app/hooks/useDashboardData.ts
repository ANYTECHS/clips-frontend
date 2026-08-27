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

import { useCallback, useEffect, useMemo } from "react";
import {
  useDashboardStore,
  selectStats,
  selectRevenueTrend,
  selectRecentProjects,
  selectLoading,
  selectError,
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
export function useDashboardData(options?: { enableStreaming?: boolean }): {
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
  // Subscribed one field at a time. A composite selector would allocate a new
  // object per store read and so never compare equal, re-rendering every
  // consumer on writes that touched neither flag.
  const loading = useDashboardStore(selectLoading);
  const error = useDashboardStore(selectError);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!options?.enableStreaming) return;

    const stream = openManagedEventSource({
      url: "/api/dashboard/stream",
      listeners: {
        stats: (data) => {
          let parsed: { data?: { earnings: string; clips: number; platforms: number } };
          try {
            parsed = JSON.parse(data);
          } catch (error) {
            // A malformed frame is the server's problem, not a reason to tear
            // down a working stream.
            logger.error("Malformed dashboard stats frame:", error);
            return;
          }
          if (!parsed?.data) return;

          // Only the stats slice is live-updated. The previous version also
          // reset revenueTrend and recentProjects to [], so the first streamed
          // frame wiped the chart and the project list that the initial fetch
          // had just populated.
          useDashboardStore.setState({
            stats: {
              earnings: { total: parsed.data.earnings, trendLabel: "+0%", trend: 0 },
              clips: { total: parsed.data.clips, trendLabel: "+0%", trend: 0 },
              platforms: { total: parsed.data.platforms, trendLabel: "Live", trend: 0 },
            },
            loading: false,
            error: null,
          });
        },
      },
      onError: (attempt, willRetry) => {
        logger.warn(
          `Dashboard stream error (attempt ${attempt}), ${willRetry ? "retrying" : "giving up"}`,
        );
      },
      onGiveUp: () => {
        // The store's own 5-minute cache and manual retry remain available.
        logger.warn("Dashboard stream gave up; falling back to cached data.");
      },
    });

    return () => {
      stream?.close();
    };
  }, [options?.enableStreaming]);

  // Held stable across renders so memoised consumers of `data` are not
  // invalidated by a re-render that changed none of the underlying slices.
  const data: DashboardData | null = useMemo(
    () => (stats !== null ? { stats, revenueTrend, recentProjects } : null),
    [stats, revenueTrend, recentProjects],
  );

  // Same reasoning: a fresh Error per render would defeat any downstream memo.
  const errorObject = useMemo(() => (error ? new Error(error) : null), [error]);

  const retry = useCallback(() => {
    invalidateCache();
    fetchDashboard();
  }, [invalidateCache, fetchDashboard]);

  return {
    data,
    loading,
    error: errorObject,
    retry,
  };
}