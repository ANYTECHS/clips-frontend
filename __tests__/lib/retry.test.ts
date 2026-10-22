/**
 * __tests__/lib/retry.test.ts
 *
 * Test suite for data fetching retry logic (#987).
 */

import { ApiError } from "@/app/lib/apiError";
import {
  BACKOFF_RETRY_OPTIONS,
  computeBackoffDelay,
  isRetryableError,
  isRetryableStatus,
  retryOperation,
  retryWithBackoff,
} from "@/app/lib/retry";

describe("isRetryableError", () => {
  it("classifies network errors (status 0) as retryable", () => {
    expect(isRetryableError(new ApiError("Network request failed", 0))).toBe(true);
    expect(isRetryableError(new Error("Failed to fetch"))).toBe(true);
    expect(isRetryableError(new Error("Network error"))).toBe(true);
  });

  it("classifies 5xx server errors as retryable", () => {
    expect(isRetryableError(new ApiError("Internal error", 500))).toBe(true);
    expect(isRetryableError(new ApiError("Bad gateway", 502))).toBe(true);
    expect(isRetryableError(new ApiError("Service unavailable", 503))).toBe(true);
    expect(isRetryableError(new ApiError("Gateway timeout", 504))).toBe(true);
  });

  it("classifies rate limit (429) as retryable", () => {
    expect(isRetryableError(new ApiError("Rate limited", 429))).toBe(true);
  });

  it("classifies client errors (400, 401, 403, 404, 405, 422) as non-retryable", () => {
    expect(isRetryableError(new ApiError("Bad request", 400))).toBe(false);
    expect(isRetryableError(new ApiError("Unauthorized", 401))).toBe(false);
    expect(isRetryableError(new ApiError("Forbidden", 403))).toBe(false);
    expect(isRetryableError(new ApiError("Not found", 404))).toBe(false);
    expect(isRetryableError(new ApiError("Unprocessable entity", 422))).toBe(false);
  });

  it("classifies AbortError as non-retryable", () => {
    const abortErr = new DOMException("Aborted", "AbortError");
    expect(isRetryableError(abortErr)).toBe(false);
  });
});

describe("retryOperation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("succeeds on first attempt without retrying", async () => {
    const fn = jest.fn().mockResolvedValue("success");
    const result = await retryOperation(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a request that fails once with 503 and then succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new ApiError("Service unavailable", 503))
      .mockResolvedValueOnce("recovered");

    const promise = retryOperation(fn, { baseDelayMs: 100, maxRetries: 3 });

    // Advance timers for first backoff (100ms)
    await jest.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries multiple consecutive failures followed by success", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new ApiError("Server error", 500))
      .mockRejectedValueOnce(new ApiError("Bad gateway", 502))
      .mockResolvedValueOnce("success-after-2-retries");

    const onRetry = jest.fn();
    const promise = retryOperation(fn, {
      baseDelayMs: 100,
      backoffFactor: 2,
      maxRetries: 3,
      onRetry,
    });

    // First retry delay: 100ms
    await jest.advanceTimersByTimeAsync(100);
    // Second retry delay: 200ms
    await jest.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe("success-after-2-retries");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(ApiError), 1, 100);
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(ApiError), 2, 200);
  });

  it("stops and surfaces final error when max retries are reached", async () => {
    const finalErr = new ApiError("Persistent 500", 500);
    const fn = jest.fn().mockRejectedValue(finalErr);

    const promise = retryOperation(fn, {
      baseDelayMs: 100,
      backoffFactor: 2,
      maxRetries: 2,
    });

    // Attach catch handler to avoid unhandled rejection warning
    let caughtError: unknown;
    promise.catch((e) => {
      caughtError = e;
    });

    // Advance 1st backoff (100ms)
    await jest.advanceTimersByTimeAsync(100);
    // Advance 2nd backoff (200ms)
    await jest.advanceTimersByTimeAsync(200);

    await expect(promise).rejects.toThrow("Persistent 500");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("does not retry non-retryable errors (e.g. 401 Unauthorized)", async () => {
    const unauthErr = new ApiError("Unauthorized", 401);
    const fn = jest.fn().mockRejectedValue(unauthErr);

    await expect(retryOperation(fn, { maxRetries: 3, baseDelayMs: 100 })).rejects.toThrow(
      "Unauthorized"
    );

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancels pending retry backoff when AbortSignal is aborted", async () => {
    const controller = new AbortController();
    const fn = jest.fn().mockRejectedValueOnce(new ApiError("Server error", 500));

    const promise = retryOperation(fn, {
      baseDelayMs: 1000,
      maxRetries: 3,
      signal: controller.signal,
    });

    let caughtError: unknown;
    promise.catch((e) => {
      caughtError = e;
    });

    // Abort midway through backoff delay
    controller.abort();
    await jest.advanceTimersByTimeAsync(1000);

    expect(caughtError).toBeDefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("retryWithBackoff", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts at 1s and doubles, capped at 30s", () => {
    const noJitter = { ...BACKOFF_RETRY_OPTIONS, jitterRatio: 0 };
    expect(computeBackoffDelay(1, noJitter)).toBe(1_000);
    expect(computeBackoffDelay(2, noJitter)).toBe(2_000);
    expect(computeBackoffDelay(3, noJitter)).toBe(4_000);
    expect(computeBackoffDelay(4, noJitter)).toBe(8_000);
    expect(computeBackoffDelay(6, noJitter)).toBe(30_000);
    expect(computeBackoffDelay(10, noJitter)).toBe(30_000);
  });

  it("adds 0–50% jitter on top of the delay", () => {
    expect(computeBackoffDelay(1, { ...BACKOFF_RETRY_OPTIONS, random: () => 0 })).toBe(1_000);
    expect(computeBackoffDelay(1, { ...BACKOFF_RETRY_OPTIONS, random: () => 0.5 })).toBe(1_250);
    expect(computeBackoffDelay(1, { ...BACKOFF_RETRY_OPTIONS, random: () => 0.999 })).toBe(1_500);
    expect(computeBackoffDelay(6, { ...BACKOFF_RETRY_OPTIONS, random: () => 0.999 })).toBe(44_985);
  });

  it("retries with the backoff sequence and reports each delay", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new ApiError("Server error", 500))
      .mockRejectedValueOnce(new ApiError("Bad gateway", 502))
      .mockResolvedValueOnce("ok");
    const onRetry = jest.fn();

    const promise = retryWithBackoff(fn, { random: () => 0, onRetry });
    await jest.advanceTimersByTimeAsync(1_000);
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(promise).resolves.toBe("ok");
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(ApiError), 1, 1_000);
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(ApiError), 2, 2_000);
  });

  it("gives up after 3 retries by default", async () => {
    const fn = jest.fn().mockRejectedValue(new ApiError("Unavailable", 503));

    const promise = retryWithBackoff(fn, { random: () => 0 });
    promise.catch(() => {});
    await jest.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000);

    await expect(promise).rejects.toThrow("Unavailable");
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it.each([400, 401, 403, 413])("fails immediately on %i", async (status) => {
    const fn = jest.fn().mockRejectedValue(new ApiError("Rejected", status));

    await expect(retryWithBackoff(fn)).rejects.toThrow("Rejected");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it.each([500, 502, 503, 504])("retries on %i", async (status) => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new ApiError("Transient", status))
      .mockResolvedValueOnce("ok");

    const promise = retryWithBackoff(fn, { random: () => 0 });
    await jest.advanceTimersByTimeAsync(1_000);

    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("classifies statuses for upload retries", () => {
    for (const status of [500, 502, 503, 504]) expect(isRetryableStatus(status)).toBe(true);
    for (const status of [400, 401, 403, 413]) expect(isRetryableStatus(status)).toBe(false);
  });
});
