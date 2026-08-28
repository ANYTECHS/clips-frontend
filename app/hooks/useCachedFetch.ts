"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  requestCache,
  type FetchOptions,
  type RequestCache,
} from "@/app/lib/cache/RequestCache";

export interface UseCachedFetchOptions<T> extends Pick<FetchOptions<T>, "tags" | "ttlMs" | "staleTtlMs" | "priority"> {
  /** Skip fetching entirely, e.g. while a required parameter is still null. */
  enabled?: boolean;
  /** Cache instance to use. Defaults to the shared one. */
  cache?: RequestCache;
}

export interface UseCachedFetchResult<T> {
  data: T | undefined;
  /** True only when there is nothing to show yet. A stale value is not loading. */
  loading: boolean;
  /** True while a background revalidation is running behind a stale value. */
  validating: boolean;
  error: Error | null;
  /** Refetch, bypassing the cache. */
  refresh: () => Promise<void>;
  /** Drop this key from the cache without refetching. */
  invalidate: () => void;
}

/**
 * Read an API endpoint through the shared stale-while-revalidate cache.
 *
 * Remounting a component that has fetched recently costs nothing, and several
 * components asking for the same key at once produce a single request. When a
 * value is stale it renders immediately while the refresh happens behind it, so
 * navigating back to a screen never flashes a skeleton over data that is only
 * seconds old.
 *
 * ```ts
 * const { data, loading, refresh } = useCachedFetch(
 *   `/api/projects/${id}`,
 *   () => fetch(`/api/projects/${id}`).then((r) => r.json()),
 *   { tags: ["projects"] },
 * );
 * ```
 */
export function useCachedFetch<T>(
  key: string | null,
  fetcher: (signal?: AbortSignal) => Promise<T>,
  options: UseCachedFetchOptions<T> = {},
): UseCachedFetchResult<T> {
  const { enabled = true, cache = requestCache, tags, ttlMs, staleTtlMs, priority } = options;

  const cached = key ? cache.peek<T>(key) : undefined;
  const [data, setData] = useState<T | undefined>(cached);
  const [loading, setLoading] = useState(enabled && !!key && cached === undefined);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Held in refs so a caller passing an inline arrow function does not
  // re-trigger the effect on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (forceRefresh: boolean) => {
      if (!key || !enabled) return;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const hadValue = cache.peek<T>(key) !== undefined;
      if (hadValue) setValidating(true);
      else setLoading(true);
      setError(null);

      try {
        const value = await cache.fetch<T>(key, (signal) => fetcherRef.current(signal), {
          signal: controller.signal,
          priority,
          tags,
          ttlMs,
          staleTtlMs,
          forceRefresh,
          onRevalidated: (fresh) => {
            if (mountedRef.current) setData(fresh);
          },
        });
        if (mountedRef.current) setData(value);
      } catch (err) {
        if (mountedRef.current && !(err instanceof Error && err.name === "AbortError")) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setValidating(false);
        }
      }
    },
    // `tags` is typically an inline array; joining it keeps the identity stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, enabled, cache, ttlMs, staleTtlMs, priority, (tags ?? []).join("|")],
  );

  useEffect(() => {
    void run(false);
    return () => abortControllerRef.current?.abort();
  }, [run]);

  const refresh = useCallback(() => run(true), [run]);

  const invalidate = useCallback(() => {
    if (key) cache.delete(key);
  }, [key, cache]);

  return { data, loading, validating, error, refresh, invalidate };
}
