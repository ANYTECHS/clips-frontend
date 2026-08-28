"use client";

import { useCachedFetch, type UseCachedFetchOptions, type UseCachedFetchResult } from "@/app/hooks/useCachedFetch";
import { apiFetch } from "@/app/lib/apiError";
import { cacheKey } from "@/app/lib/cache/RequestCache";

export interface UseApiQueryOptions<T> extends UseCachedFetchOptions<T> {
  /** `fetch` init (method, headers, body) passed through to `apiFetch`. */
  init?: RequestInit;
  /** Automatic retries on failure, with exponential backoff. Default 0 (no retry). */
  retry?: number;
  /** Base delay in ms between retries, doubled each attempt. Default 500. */
  retryDelayMs?: number;
}

export type UseApiQueryResult<T> = UseCachedFetchResult<T>;

function withRetry<T>(fn: (signal?: AbortSignal) => Promise<T>, retries: number, delayMs: number): (signal?: AbortSignal) => Promise<T> {
  if (retries <= 0) return fn;
  return async (signal) => {
    let attempt = 0;
     
    while (true) {
      try {
        return await fn(signal);
      } catch (err) {
        if (attempt >= retries) throw err;
        await new Promise<void>((resolve, reject) => {
          if (signal?.aborted) {
            reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
            return;
          }
          const timer = setTimeout(resolve, delayMs * 2 ** attempt);
          signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
          }, { once: true });
        });
        attempt += 1;
      }
    }
  };
}

/**
 * The app's unified data-fetching hook. Wraps the shared stale-while-revalidate
 * cache (`useCachedFetch` / `RequestCache`) with a normalized fetcher
 * (`apiFetch`, throwing `ApiError` on failure) so every read goes through the
 * same caching, deduplication, and error-handling path. See
 * `app/hooks/DATA_FETCHING.md` for the full rationale and usage patterns.
 *
 * ```ts
 * const { data, loading, error, refresh } = useApiQuery<Project[]>(
 *   cacheKey("/api/projects", { page }),
 *   "/api/projects?" + new URLSearchParams({ page: String(page) }),
 *   { tags: ["projects"] },
 * );
 * ```
 */
export function useApiQuery<T>(
  key: string | null,
  url: string | null,
  options: UseApiQueryOptions<T> = {},
): UseApiQueryResult<T> {
  const { init, retry = 0, retryDelayMs = 500, ...cachedFetchOptions } = options;

  const fetcher = withRetry(
    (signal) => apiFetch<T>(url as string, { ...init, signal: signal ?? init?.signal }),
    retry,
    retryDelayMs,
  );

  return useCachedFetch<T>(key, fetcher, {
    ...cachedFetchOptions,
    enabled: (cachedFetchOptions.enabled ?? true) && !!url,
  });
}

export { cacheKey };
