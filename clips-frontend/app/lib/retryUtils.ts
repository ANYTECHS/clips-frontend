/**
 * retryUtils.ts
 *
 * Generic retry and backoff utilities used across wallet creation and
 * other async operations that may fail transiently.
 */

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /**
   * Base delay in milliseconds for exponential backoff.
   * Delay after attempt n = baseDelayMs * 2^(n-1), capped at maxDelayMs.
   * Default: 500
   */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds. Default: 8000 */
  maxDelayMs?: number;
  /**
   * Optional predicate — if it returns true for a given error, the retry
   * loop stops immediately (non-retryable error).
   */
  shouldAbort?: (err: unknown) => boolean;
  /** Called before each retry with the attempt number (1-indexed) and the error. */
  onRetry?: (attempt: number, err: unknown) => void;
}

/**
 * Execute `fn` with exponential backoff retries.
 *
 * @example
 * const result = await withRetry(() => fetchSomething(), { maxAttempts: 3 });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    shouldAbort,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Stop immediately for non-retryable errors
      if (shouldAbort?.(err)) {
        throw err;
      }

      // No more retries left
      if (attempt === maxAttempts) {
        break;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      onRetry?.(attempt, err);
      await sleep(delay);
    }
  }

  throw lastError;
}

/** Promise-based sleep helper */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt `fn` and return a fallback value instead of throwing.
 * Useful for non-critical operations (e.g. Friendbot funding) where
 * failure should degrade gracefully rather than surface an error.
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
  onError?: (err: unknown) => void
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    onError?.(err);
    return fallback;
  }
}
