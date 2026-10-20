"use client";

import { useEffect, useRef } from "react";
import { isMemoryProfilingSupported, takeMemorySnapshot, detectLeakSources } from "@/app/lib/memoryProfiler";
import { reportMetric } from "@/app/lib/performanceMonitoring";
import { logger } from "@/app/lib/logger";

export interface UseMemoryMonitorOptions {
  /** Sampling period in ms. Default 30s in development, 60s in production. */
  intervalMs?: number;
  /** Skip entirely, e.g. to gate this behind a feature flag. Default true. */
  enabled?: boolean;
  /** Enable leak detection in development. Default true in dev, false in prod. */
  detectLeaks?: boolean;
}

const DEV_INTERVAL_MS = 30_000;
const PROD_INTERVAL_MS = 60_000;
const LEAK_THRESHOLD_MB = 50;
const LEAK_WINDOW_MS = 5 * 60_000;

/**
 * Periodically samples `performance.memory` (Chrome-only; a no-op elsewhere,
 * including tests) and reports heap usage through the existing performance
 * pipeline (`reportMetric`), so a session's heap trend shows up next to Web
 * Vitals and other custom metrics in Sentry/analytics instead of needing a
 * separate tool.
 *
 * In development mode, this also:
 * - Logs heap usage every 30 seconds
 * - Triggers a console warning when heap usage increases by more than 50MB over 5 minutes
 * - Detects common leak sources (event listeners, workers, etc.)
 *
 * This does not detect leaks by itself — see `app/lib/memoryProfiler.ts` for
 * the profiling primitives this is built on, and
 * `docs/memory-leak-detection.md` for how the two fit together. It only
 * establishes the ongoing signal; noticing a bad trend is a job for
 * dashboards/alerting on the reported metric, not this hook.
 */
export function useMemoryMonitor({
  intervalMs = process.env.NODE_ENV === "development" ? DEV_INTERVAL_MS : PROD_INTERVAL_MS,
  enabled = true,
  detectLeaks = process.env.NODE_ENV === "development",
}: UseMemoryMonitorOptions = {}): void {
  const baselineSnapshotRef = useRef<ReturnType<typeof takeMemorySnapshot> | null>(null);
  const lastSnapshotTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !isMemoryProfilingSupported()) return;

    const sample = () => {
      const snapshot = takeMemorySnapshot();
      if (!snapshot || snapshot.jsHeapSizeLimit <= 0) return;

      // Report to analytics in all environments
      reportMetric("memory.heapUsedRatio", snapshot.usedJSHeapSize / snapshot.jsHeapSizeLimit, {
        usedMB: Math.round(snapshot.usedJSHeapSize / (1024 * 1024)),
        totalMB: Math.round(snapshot.totalJSHeapSize / (1024 * 1024)),
      });

      // Development-specific monitoring
      if (process.env.NODE_ENV === "development") {
        const usedMB = Math.round(snapshot.usedJSHeapSize / (1024 * 1024));
        logger.info(`[Memory] Heap usage: ${usedMB}MB (${Math.round(snapshot.usedJSHeapSize / snapshot.jsHeapSizeLimit * 100)}%)`);

        // Check for memory leak patterns
        if (detectLeaks) {
          const now = Date.now();
          const timeSinceBaseline = now - lastSnapshotTimeRef.current;

          if (baselineSnapshotRef.current && timeSinceBaseline >= LEAK_WINDOW_MS) {
            const deltaMB = (snapshot.usedJSHeapSize - baselineSnapshotRef.current.usedJSHeapSize) / (1024 * 1024);

            if (deltaMB > LEAK_THRESHOLD_MB) {
              logger.warn(
                `[Memory] Potential leak detected: heap increased by ${Math.round(deltaMB)}MB over ${Math.round(timeSinceBaseline / 1000)}s`,
                {
                  baselineMB: Math.round(baselineSnapshotRef.current.usedJSHeapSize / (1024 * 1024)),
                  currentMB: usedMB,
                  deltaMB: Math.round(deltaMB),
                }
              );

              // Check for common leak sources
              const leakSources = detectLeakSources();
              if (leakSources.length > 0) {
                logger.warn("[Memory] Detected potential leak sources:", leakSources);
              }
            }

            // Reset baseline after checking
            baselineSnapshotRef.current = snapshot;
            lastSnapshotTimeRef.current = now;
          } else if (!baselineSnapshotRef.current) {
            baselineSnapshotRef.current = snapshot;
            lastSnapshotTimeRef.current = now;
          }
        }
      }
    };

    sample();
    const interval = setInterval(sample, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, intervalMs, detectLeaks]);
}
