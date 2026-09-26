"use client";

import { useCachedFetch, type UseCachedFetchOptions, type UseCachedFetchResult } from "@/app/hooks/useCachedFetch";
import { apiFetch } from "@/app/lib/apiError";
import { cacheKey } from "@/app/lib/cache/RequestCache";
import { retryOperation, type RetryOptions } from "@/app/lib/retry";

export interface UseApiQueryOptions<T> extends UseCachedFetchOptions<T> {
  /** `fetch` init (method, headers, body) passed through to `apiFetch`. */
  init?: RequestInit;
  /** Automatic retries on failure, with exponential backoff. Default 0 (no retry). */
  retry?: number;
  /** Base delay in ms between retries, doubled each attempt. Default 500. */
  retryDelayMs?: number;
  /** Detailed retry options. Override `retry` and `retryDelayMs` if provided. */
  retryOptions?: RetryOptions;
}

export type UseApiQueryResult<T> = UseCachedFetchResult<T>;

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
 *   { tags: ["projects"], retry: 3 },
 * );
 * ```
 */
export function useApiQuery<T>(
  key: string | null,
  url: string | null,
  options: UseApiQueryOptions<T> = {},
): UseApiQueryResult<T> {
  const { init, retry = 0, retryDelayMs = 500, retryOptions, ...cachedFetchOptions } = options;

  const effectiveRetryOptions: RetryOptions = {
    maxRetries: retryOptions?.maxRetries ?? retry,
    baseDelayMs: retryOptions?.baseDelayMs ?? retryDelayMs,
    ...retryOptions,
  };

  const fetcher = (signal?: AbortSignal) =>
    retryOperation(
      (execSignal) =>
        apiFetch<T>(url as string, {
          ...init,
          signal: execSignal ?? init?.signal,
        }),
      {
        ...effectiveRetryOptions,
        signal: signal ?? init?.signal,
      },
    );

  return useCachedFetch<T>(key, fetcher, {
    ...cachedFetchOptions,
    enabled: (cachedFetchOptions.enabled ?? true) && !!url,
  });
}

export { cacheKey };

