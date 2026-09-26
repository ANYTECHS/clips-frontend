/**
 * Shared RequestCache instance for the entire application.
 * 
 * Single source of truth for all cached API requests, with optimized
 * defaults for the clips application.
 */

import { RequestCache } from "./RequestCache";
import { fetchAnalytics } from "./FetchAnalytics";

/**
 * Global request cache with production-tuned settings:
 * - 60s fresh TTL for most API responses
 * - 5-minute stale window for background revalidation
 * - 200-entry LRU cache (enough for a long session browsing clips)
 * - 6 concurrent requests max (browser default)
 */
export const requestCache = new RequestCache({
  ttlMs: 60_000, // 1 minute fresh
  staleTtlMs: 5 * 60_000, // 5 minutes stale-while-revalidate
  maxEntries: 200,
  maxConcurrent: 6,
  analytics: fetchAnalytics,
});

/**
 * Convenience wrapper around requestCache.fetch with type safety.
 */
export async function cachedFetch<T>(
  url: string,
  options: RequestInit & {
    priority?: "high" | "normal" | "low";
    tags?: string[];
    ttlMs?: number;
    forceRefresh?: boolean;
  } = {}
): Promise<T> {
  const { priority, tags, ttlMs, forceRefresh, ...fetchOptions } = options;

  return requestCache.fetch(
    url,
    (signal) =>
      fetch(url, { ...fetchOptions, signal }).then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      }),
    { priority, tags, ttlMs, forceRefresh }
  );
}

/**
 * Invalidate cache entries by tag.
 * Use after mutations to ensure stale data is refreshed.
 * 
 * @example
 * ```ts
 * // After creating a clip
 * await createClip(data);
 * invalidateCacheTags(['clips', 'projects']);
 * ```
 */
export function invalidateCacheTags(...tags: string[]): number {
  return requestCache.invalidateTags(...tags);
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats() {
  return requestCache.stats();
}
