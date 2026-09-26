/**
 * app/lib/retry.ts
 *
 * Centralised data-fetching retry mechanism with exponential backoff,
 * transient error detection, and AbortSignal cancellation support.
 *
 * Issue #987 – Add data fetching retry logic.
 */

import { ApiError, apiFetch } from "@/app/lib/apiError";

export interface RetryOptions {
  /** Maximum number of retries (excluding initial attempt). Default 3. */
  maxRetries?: number;
  /** Base delay in milliseconds before the first retry. Default 500. */
  baseDelayMs?: number;
  /** Upper cap for exponential backoff delay in milliseconds. Default 10000. */
  maxDelayMs?: number;
  /** Exponential backoff multiplier. Default 2. */
  backoffFactor?: number;
  /** Custom predicate to determine whether an error should be retried. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback triggered before entering backoff sleep for a retry. */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** AbortSignal to cancel pending retries immediately. */
  signal?: AbortSignal;
}

/** Default retry configuration values. */
export const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, "shouldRetry" | "onRetry" | "signal">> = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  backoffFactor: 2,
};

/**
 * Determine if an error represents a transient failure that should be retried.
 *
 * Retryable errors:
 * - Network failures / connection drops (ApiError status 0 or network message)
 * - Server errors (500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout)
 * - Rate limits (429 Too Many Requests)
 *
 * Non-retryable errors:
 * - Client errors (400, 401, 403, 404, 405, 409, 422, etc.)
 * - Explicit AbortError / user cancellations
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Do not retry explicitly cancelled operations
  if (error instanceof Error && error.name === "AbortError") {
    return false;
  }

  if (error instanceof ApiError) {
    // Network failures (status 0) and 429 Rate Limit are retryable
    if (error.status === 0 || error.status === 429) {
      return true;
    }
    // Server errors (5xx) are retryable
    if (error.status >= 500 && error.status <= 599) {
      return true;
    }
    // Client errors (4xx except 429) are non-retryable
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("failed to fetch") ||
      msg.includes("network error") ||
      msg.includes("network request failed") ||
      msg.includes("fetch failed") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout")
    ) {
      return true;
    }
  }

  // Default to false for unrecognized error objects to prevent unexpected retry loops
  return false;
}

/**
 * Execute an async function with exponential backoff retries and AbortSignal cancellation.
 */
export async function retryOperation<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_OPTIONS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs;
  const backoffFactor = options.backoffFactor ?? DEFAULT_RETRY_OPTIONS.backoffFactor;
  const signal = options.signal;

  let attempt = 0;

  while (true) {
    if (signal?.aborted) {
      const abortErr = signal.reason || new Error("The operation was aborted");
      if (abortErr instanceof Error && !abortErr.name) abortErr.name = "AbortError";
      throw abortErr;
    }

    try {
      return await fn(signal);
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw error;
      }

      const canRetry = options.shouldRetry
        ? options.shouldRetry(error, attempt + 1)
        : isRetryableError(error);

      if (attempt >= maxRetries || !canRetry) {
        throw error;
      }

      const delayMs = Math.min(baseDelayMs * Math.pow(backoffFactor, attempt), maxDelayMs);
      attempt += 1;

      options.onRetry?.(error, attempt, delayMs);

      await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          const abortErr = signal.reason || new Error("The operation was aborted");
          if (abortErr instanceof Error && !abortErr.name) abortErr.name = "AbortError";
          reject(abortErr);
          return;
        }

        // eslint-disable-next-line prefer-const
        let timer: ReturnType<typeof setTimeout>;

        const onAbort = () => {
          clearTimeout(timer);
          const abortErr = signal?.reason || new Error("The operation was aborted");
          if (abortErr instanceof Error && !abortErr.name) abortErr.name = "AbortError";
          reject(abortErr);
        };

        timer = setTimeout(() => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        }, delayMs);

        signal?.addEventListener("abort", onAbort, { once: true });
      });
    }
  }
}

/**
 * Perform a `fetch` using `apiFetch` and `retryOperation`.
 */
export async function fetchWithRetry<T>(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions,
): Promise<T> {
  const signal = retryOptions?.signal ?? init?.signal;
  return retryOperation(
    (execSignal) =>
      apiFetch<T>(url, {
        ...init,
        signal: execSignal ?? init?.signal,
      }),
    {
      ...retryOptions,
      signal,
    },
  );
}
