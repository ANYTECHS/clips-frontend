/**
 * CLS (Cumulative Layout Shift) Monitoring Hook (#873)
 *
 * Tracks layout shifts in development to identify CLS issues.
 * Automatically logs shifts with attribution data to help debug problems.
 */

import { useEffect } from "react";
import { debugLayoutShifts } from "@/app/lib/layoutShiftPrevention";

/**
 * Monitor and debug layout shifts during development.
 * No-op in production to avoid performance overhead.
 * 
 * @example
 * ```tsx
 * function MyPage() {
 *   useCLSMonitoring();
 *   return <div>...</div>;
 * }
 * ```
 */
export function useCLSMonitoring() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    const cleanup = debugLayoutShifts();
    return cleanup;
  }, []);
}
