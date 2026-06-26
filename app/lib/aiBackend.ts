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
export async function dispatchJob(payload: DispatchJobPayload): Promise<DispatchResult> {
  const baseUrl = process.env.NEXT_PUBLIC_AI_API_URL;

  if (!baseUrl) {
    console.warn(
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

  try {
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
      console.error(
        `[aiBackend] Dispatch failed for job ${payload.jobId}: ` +
          `${res.status} ${res.statusText} — ${text}`
      );
      return {
        dispatched: false,
        reason: `HTTP_${res.status}`,
      };
    }

    const data = (await res.json().catch(() => ({}))) as { jobId?: string };
    return {
      dispatched: true,
      remoteJobId: data.jobId ?? payload.jobId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[aiBackend] Dispatch error for job ${payload.jobId}: ${message}`);
    return { dispatched: false, reason: message };
  }
}
