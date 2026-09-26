"use client";

import { useEffect } from "react";
import { isMemoryProfilingSupported, takeMemorySnapshot } from "@/app/lib/memoryProfiler";
import { reportMetric } from "@/app/lib/performanceMonitoring";

export interface UseMemoryMonitorOptions {
  /** Sampling period in ms. Default 60s — heap usage doesn't need finer resolution than that. */
  intervalMs?: number;
  /** Skip entirely, e.g. to gate this behind a feature flag. Default true. */
  enabled?: boolean;
}

const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Periodically samples `performance.memory` (Chrome-only; a no-op elsewhere,
 * including tests) and reports heap usage through the existing performance
 * pipeline (`reportMetric`), so a session's heap trend shows up next to Web
 * Vitals and other custom metrics in Sentry/analytics instead of needing a
 * separate tool.
 *
 * This does not detect leaks by itself — see `app/lib/memoryProfiler.ts` for
 * the profiling primitives this is built on, and
 * `docs/memory-leak-detection.md` for how the two fit together. It only
 * establishes the ongoing signal; noticing a bad trend is a job for
 * dashboards/alerting on the reported metric, not this hook.
 */
export function useMemoryMonitor({
  intervalMs = DEFAULT_INTERVAL_MS,
  enabled = true,
}: UseMemoryMonitorOptions = {}): void {
  useEffect(() => {
    if (!enabled || !isMemoryProfilingSupported()) return;

    const sample = () => {
      const snapshot = takeMemorySnapshot();
      if (!snapshot || snapshot.jsHeapSizeLimit <= 0) return;

      reportMetric("memory.heapUsedRatio", snapshot.usedJSHeapSize / snapshot.jsHeapSizeLimit, {
        usedMB: Math.round(snapshot.usedJSHeapSize / (1024 * 1024)),
        totalMB: Math.round(snapshot.totalJSHeapSize / (1024 * 1024)),
      });
    };

    sample();
    const interval = setInterval(sample, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, intervalMs]);
}
