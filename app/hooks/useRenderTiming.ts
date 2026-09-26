"use client";

/**
 * Reports how long a heavy component took from render start to committed
 * paint, via the existing performance-monitoring pipeline (`render.<name>`),
 * so slow renders of components like ClipGrid or TransactionHistoryViewer
 * show up next to the rest of the app's performance telemetry instead of
 * only being visible in a profiler someone has to remember to open.
 */

import { useEffect, useRef } from "react";
import { reportMetric } from "@/app/lib/performanceMonitoring";

export function useRenderTiming(name: string, deps: readonly unknown[]): void {
  const startRef = useRef(0);
  startRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();

  useEffect(() => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    reportMetric(`render.${name}`, now - startRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
