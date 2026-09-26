"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Hover must last this long before we treat it as intent to navigate. */
export const PREFETCH_INTENT_DELAY_MS = 120;

export interface RoutePrefetchHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onTouchStart: () => void;
}

/**
 * Prefetch a route on genuine navigation intent.
 *
 * `<Link>` prefetches everything that scrolls into view, which for a sidebar
 * means every dashboard route is fetched the moment the shell renders — a dozen
 * payloads on a slow connection, for the one route the user actually wanted.
 * Pairing `prefetch={false}` with these handlers moves that work to the point
 * where a user shows interest.
 *
 * A short delay filters out a pointer sweeping across the nav on its way
 * somewhere else. Keyboard focus and touch-start count as intent immediately:
 * both mean the user has already committed to that target.
 *
 * Each route is prefetched at most once per mount.
 */
export function useRoutePrefetch(href: string): RoutePrefetchHandlers {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const prefetchNow = useCallback(() => {
    cancel();
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    try {
      router.prefetch(href);
    } catch {
      // Prefetching is an optimisation; a failure must never break navigation.
    }
  }, [cancel, href, router]);

  const prefetchOnIntent = useCallback(() => {
    if (prefetchedRef.current || timerRef.current !== null) return;
    timerRef.current = setTimeout(prefetchNow, PREFETCH_INTENT_DELAY_MS);
  }, [prefetchNow]);

  useEffect(() => cancel, [cancel]);

  return {
    onMouseEnter: prefetchOnIntent,
    onMouseLeave: cancel,
    onFocus: prefetchNow,
    onBlur: cancel,
    onTouchStart: prefetchNow,
  };
}
