

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
  /**
   * Maximum random jitter added on top of each delay, as a fraction of it
   * (0.5 adds 0–50%). Default 0 (no jitter).
   */
  jitterRatio?: number;
  /** Random source in [0, 1) used for jitter. Injectable for tests. Default Math.random. */
  random?: () => number;
  /** Custom predicate to determine whether an error should be retried. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback triggered before entering backoff sleep for a retry. */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** AbortSignal to cancel pending retries immediately. */
  signal?: AbortSignal;
}

/** Default retry configuration values. */
export const DEFAULT_RETRY_OPTIONS: Required<
  Omit<RetryOptions, "shouldRetry" | "onRetry" | "signal" | "random">
> = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  backoffFactor: 2,
  jitterRatio: 0,
};

/**
 * Backoff profile for `retryWithBackoff`: 1s doubling to a 30s cap, with up
 * to 50% random jitter so clients that failed together don't all retry at the
 * same instant when the server recovers (thundering herd).
 */
export const BACKOFF_RETRY_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffFactor: 2,
  jitterRatio: 0.5,
} as const;

/** HTTP statuses that fail immediately: re-sending the same request can't succeed. */
export const NON_RETRYABLE_STATUS_CODES: readonly number[] = [400, 401, 403, 413];

/** HTTP statuses that are transient and trigger the backoff sequence. */
export const RETRYABLE_STATUS_CODES: readonly number[] = [408, 429, 500, 502, 503, 504];

/**
 * Whether an HTTP status is worth another attempt: the transient statuses in
 * RETRYABLE_STATUS_CODES plus any other 5xx. Every other 4xx — including the
 * explicit NON_RETRYABLE_STATUS_CODES — is final.
 */
export function isRetryableStatus(status: number): boolean {
  if (NON_RETRYABLE_STATUS_CODES.includes(status)) return false;
  if (RETRYABLE_STATUS_CODES.includes(status)) return true;
  return status >= 500 && status <= 599;
}

/**
 * Delay before retry number `attempt` (1-based): exponential from
 * `baseDelayMs`, capped at `maxDelayMs`, plus `jitterRatio` × random of it.
 */
export function computeBackoffDelay(
  attempt: number,
  options: Pick<RetryOptions, "baseDelayMs" | "maxDelayMs" | "backoffFactor" | "jitterRatio" | "random"> = {},
): number {
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_OPTIONS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs;
  const backoffFactor = options.backoffFactor ?? DEFAULT_RETRY_OPTIONS.backoffFactor;
  const jitterRatio = options.jitterRatio ?? DEFAULT_RETRY_OPTIONS.jitterRatio;
  const random = options.random ?? Math.random;

  const capped = Math.min(baseDelayMs * Math.pow(backoffFactor, attempt - 1), maxDelayMs);
  const jitter = jitterRatio > 0 ? capped * jitterRatio * random() : 0;
  return Math.round(capped + jitter);
}

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
    if (error.status === 0) {
      return true;
    }
    // Transient statuses (408, 429, 5xx) are retryable
    if (isRetryableStatus(error.status)) {
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

      attempt += 1;
      const delayMs = computeBackoffDelay(attempt, options);

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
 * Run `fn` with exponential backoff and jitter: 1s, 2s, 4s, … capped at 30s,
 * each plus a random 0–50%, up to 3 retries by default. Any of those can be
 * overridden through `options`.
 *
 * Errors are classified by `isRetryableError` unless `shouldRetry` is given:
 * network failures and 408/429/5xx retry; 400/401/403/413 and other 4xx fail
 * immediately; aborts are never retried.
 */
export function retryWithBackoff<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  // Explicitly-undefined fields must not knock out the backoff defaults.
  const merged: RetryOptions = { ...BACKOFF_RETRY_OPTIONS };
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
  }
  return retryOperation(fn, merged);
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
