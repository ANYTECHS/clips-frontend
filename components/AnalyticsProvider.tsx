"use client";

import { useEffect } from "react";
import analytics from "@/app/lib/analytics";

/**
 * Triggers analytics/third-party script loading (#917) once the browser is
 * idle, rather than during initial render. `analytics.initialize()` is a
 * no-op until cookie consent is given (see app/lib/analytics.ts), so this is
 * safe to schedule unconditionally on every load.
 */
export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => analytics.initialize(), { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }

    const timeoutId = setTimeout(() => analytics.initialize(), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  return <>{children}</>;
}
