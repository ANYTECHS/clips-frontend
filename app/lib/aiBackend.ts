import type { AnimeTransformOptions } from "@/app/lib/animeTransform";
import { logger } from "@/app/lib/logger";
import { getCircuitBreaker } from "@/app/lib/circuitBreaker";
import { withRetry } from "@/app/lib/retryUtils";

/**
 * aiBackend.ts — thin client for dispatching video processing jobs to the AI
 * backend service.
 *
 * The backend is expected to:
 * 1. Accept a POST to /jobs with the job payload.
 * 2. Process the video asynchronously.
 * 3. Report progress by calling back to our /api/jobs/[id]/callback endpoint
 * with a shared secret (AI_BACKEND_CALLBACK_SECRET).
 *
 * Environment variables:
 * NEXT_PUBLIC_AI_API_URL        — Base URL of the AI processing service.
 * Required in production. When absent in dev
 * the dispatch is skipped and a warning is
 * logged — the job stays in "queued" status
 * so the UI is never left in a broken state.
 * AI_BACKEND_SECRET             — Shared secret sent as a Bearer token on
 * outbound requests so the AI backend can
 * verify the call is from us.
 * AI_BACKEND_CALLBACK_SECRET    — Secret the AI backend must include when
 * calling our /api/jobs/[id]/callback route.
 * See that route for validation details.
 */

/**
 * Payload configuration sent to the remote AI service containing job targets and tracking endpoints.
 */
export interface DispatchJobPayload {
  /** Stable job id — the AI backend echoes this in every callback. */
  jobId: string;
  /** Authenticated owner (for audit / rate limiting on the backend). */
  userId: string;
  /** Full object key in the S3-compatible bucket. */
  objectKey: string;
  /** MIME type of the uploaded file. */
  contentType: string;
  /** Original filename — may be used for display/logging on the backend. */
  filename: string;
  /**
   * Full URL the AI backend should POST progress updates to.
   * Format: POST <callbackUrl>  body: JobCallbackPayload
   */
  callbackUrl: string;
  /**
   * Optional: the visual style to apply for AI video transformation jobs
   * (e.g. "anime", "cinematic", "sketch", "watercolor").
   * Absent for standard clip-extraction jobs.
   */
  transformStyle?: string;
  /**
   * Optional: the source clip's object key in cloud storage, used when the
   * job is a style-transfer transformation rather than a raw upload.
   */
  sourceClipKey?: string;
  /**
   * Optional: fine-grained tuning options for anime transformations.
   * Only populated when transformStyle === "anime".
   */
  transformOptions?: AnimeTransformOptions;
  /** Job type discriminator for the AI backend. */
  jobType?: "clip" | "transform" | "transcode" | "caption";
  /** Transcode export settings when jobType === "transcode". */
  transcodeOptions?: {
    format: "mp4" | "webm";
    aspectRatio: "9:16" | "1:1" | "16:9";
    quality: "720p" | "1080p";
    outputObjectKey: string;
  };
}

/**
 * The resulting payload returned after executing a remote dispatch attempt.
 */
export interface DispatchResult {
  /** Whether the dispatch call succeeded. */
  dispatched: boolean;
  /** Remote job id assigned by the AI backend (may differ from our jobId). */
  remoteJobId?: string;
  /** Human-readable reason if dispatched === false. */
  reason?: string;
}

/**
 * Dispatch a video processing job to the AI backend.
 *
 * Never throws — on failure it returns `{ dispatched: false, reason }` so the
 * upload response can still succeed and the job stays in "queued" status.
 *
 * @param payload - The data configuration payload containing media targets and identifiers.
 * @returns An object detailing dispatch success and the remote identifier or failure reason.
 * @example
 * ```typescript
 * const result = await dispatchJob({
 * jobId: "job_123",
 * userId: "user_456",
 * objectKey: "uploads/video.mp4",
 * contentType: "video/mp4",
 * filename: "clip.mp4",
 * callbackUrl: "[https://example.com/api/jobs/job_123/callback](https://example.com/api/jobs/job_123/callback)"
 * });
 * ```
 */
/**
 * The fallback result returned whenever the circuit is open or all retries
 * are exhausted. The job is left in "queued" state; the AI backend can be
 * re-dispatched once service is restored via POST /api/jobs/[id].
 */
const DISPATCH_FALLBACK: DispatchResult = {
  dispatched: false,
  reason: "AI_BACKEND_UNAVAILABLE",
};

/**
 * Perform the raw HTTP dispatch to the AI backend.
 * Throws on any failure so the circuit breaker and retry wrapper can act on it.
 */
async function doDispatch(
  baseUrl: string,
  headers: Record<string, string>,
  payload: DispatchJobPayload
): Promise<DispatchResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/jobs`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    // 10-second timeout for the dispatch call itself; processing is async.
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    const reason = `HTTP_${res.status}`;
    logger.error(
      `[aiBackend] Dispatch failed for job ${payload.jobId}: ` +
        `${res.status} ${res.statusText} — ${text}`
    );
    // 4xx errors (except 429) are not retryable — signal that with a typed error.
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      const err = new Error(reason);
      (err as Error & { nonRetryable: boolean }).nonRetryable = true;
      throw err;
    }
    throw new Error(reason);
  }

  const data = (await res.json().catch(() => ({}))) as { jobId?: string };
  return {
    dispatched: true,
    remoteJobId: data.jobId ?? payload.jobId,
  };
}

export async function dispatchJob(payload: DispatchJobPayload): Promise<DispatchResult> {
  const baseUrl = process.env.NEXT_PUBLIC_AI_API_URL;

  if (!baseUrl) {
    logger.warn(
      `[aiBackend] NEXT_PUBLIC_AI_API_URL is not set — job ${payload.jobId} ` +
        "will remain in 'queued' status until the AI backend is configured."
    );
    return { dispatched: false, reason: "AI_API_URL_NOT_CONFIGURED" };
  }

  const secret = process.env.AI_BACKEND_SECRET;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
  };

  const cb = getCircuitBreaker("aiBackend");

  return cb.execute(
    () =>
      withRetry(() => doDispatch(baseUrl, headers, payload), {
        maxAttempts: 3,
        baseDelayMs: 500,
        maxDelayMs: 4_000,
        // Don't retry client-side errors (4xx except 429)
        shouldAbort: (err) =>
          err instanceof Error &&
          (err as Error & { nonRetryable?: boolean }).nonRetryable === true,
        onRetry: (attempt, err) => {
          const message = err instanceof Error ? err.message : String(err);
          logger.warn(
            `[aiBackend] Retrying dispatch for job ${payload.jobId} ` +
              `(attempt ${attempt}): ${message}`
          );
        },
      }),
    () => {
      logger.warn(
        `[aiBackend] Circuit open — job ${payload.jobId} queued for later dispatch`
      );
      return DISPATCH_FALLBACK;
    }
  );
}
