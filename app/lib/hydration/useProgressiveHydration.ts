"use client";

import { useEffect, useRef, useState } from "react";

export type HydrationStrategy = "immediate" | "idle" | "visible";

/**
 * Defers marking a section "ready to hydrate" until the chosen strategy is
 * satisfied, so heavy client islands don't compete with above-the-fold
 * content for the main thread right after the initial HTML lands.
 *
 * - "immediate": ready on mount (equivalent to normal hydration).
 * - "idle": ready once the browser reports idle time (falls back to a short
 *   timeout on browsers without requestIdleCallback, e.g. Safari).
 * - "visible": ready once the element referenced by `ref` scrolls into the
 *   viewport (falls back to "idle" behavior if IntersectionObserver is
 *   unavailable, e.g. during SSR or in older browsers).
 *
 * Returns a ref to attach to the section's wrapper element and a boolean
 * flag for whether the real content should now be mounted.
 */
export function useProgressiveHydration<T extends HTMLElement = HTMLDivElement>(
  strategy: HydrationStrategy = "visible"
): { ref: React.RefObject<T>; isReady: boolean } {
  const ref = useRef<T>(null);
  const [isReady, setIsReady] = useState(strategy === "immediate");

  useEffect(() => {
    if (strategy === "immediate" || isReady) return;

    if (strategy === "idle") {
      return scheduleIdleHydration(() => setIsReady(true));
    }

    // strategy === "visible"
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      return scheduleIdleHydration(() => setIsReady(true));
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy]);

  return { ref, isReady };
}

function scheduleIdleHydration(callback: () => void): () => void {
  type IdleWindow = Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  const idleWindow = window as IdleWindow;

  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 2000 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const timeout = window.setTimeout(callback, 200);
  return () => window.clearTimeout(timeout);
}
