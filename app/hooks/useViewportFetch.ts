"use client";

import type { RefObject } from "react";
import { useIntersectionObserver } from "@/app/hooks/useIntersectionObserver";
import { useCachedFetch, type UseCachedFetchOptions, type UseCachedFetchResult } from "@/app/hooks/useCachedFetch";

export interface UseViewportFetchOptions<T> extends UseCachedFetchOptions<T> {
  /** Distance from the viewport at which to start fetching. Default "200px". */
  rootMargin?: string;
}

export interface UseViewportFetchResult<T, E extends Element> extends UseCachedFetchResult<T> {
  /** Attach to the element that should trigger the fetch when it nears the viewport. */
  ref: RefObject<E | null>;
  isIntersecting: boolean;
}

/**
 * Like `useCachedFetch`, but the request only fires once the watched element
 * scrolls near the viewport, instead of on mount. Useful for below-fold
 * widgets (secondary stats, sidebars, related-content rails) that would
 * otherwise fetch data the user may never scroll to see.
 *
 * ```tsx
 * const { ref, data, loading } = useViewportFetch<Stats, HTMLDivElement>(
 *   "/api/stats/secondary",
 *   () => fetch("/api/stats/secondary").then((r) => r.json()),
 * );
 * return <div ref={ref}>{loading ? <Skeleton /> : <Stats data={data} />}</div>;
 * ```
 */
export function useViewportFetch<T, E extends Element = Element>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: UseViewportFetchOptions<T> = {},
): UseViewportFetchResult<T, E> {
  const { rootMargin = "200px", enabled = true, ...cachedFetchOptions } = options;

  const { ref, isIntersecting } = useIntersectionObserver<E>({ rootMargin, once: true });

  const result = useCachedFetch<T>(key, fetcher, {
    ...cachedFetchOptions,
    enabled: enabled && isIntersecting,
  });

  return { ref, isIntersecting, ...result };
}
