import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "../shared/jobStore";
import { requireJobOwner } from "../shared/authGuard";
import { checkCsrf } from "@/app/lib/csrf";
import { dispatchJob } from "@/app/lib/aiBackend";
import { applyRateLimit } from "@/app/lib/serverRateLimit";

/** Accepts UUID (with or without hyphens) or alphanumeric slugs up to 64 chars. */
const JOB_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function validateJobId(id: string): NextResponse | null {
  if (!JOB_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid job id format" }, { status: 400 });
  }
  return null;
}

// ─── GET /api/jobs/[id] ───────────────────────────────────────────────────────
// Returns real job status from the store. No simulation — the AI backend is
// the sole writer of progress/status via the callback route.

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rateLimited = applyRateLimit(request, { limit: 120, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { id: jobId } = await context.params;
  const idError = validateJobId(jobId);
  if (idError) return idError;

  const result = await requireJobOwner(jobId);
  if (result instanceof NextResponse) return result;

  const { job } = result;

  return NextResponse.json({
    progress: job.progress,
    status: job.status,
    momentsFound: job.momentsFound,
    estimatedSecondsRemaining: job.estimatedSecondsRemaining,
    ...(job.errorCode ? { errorCode: job.errorCode } : {}),
    ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
  });
}

// ─── POST /api/jobs/[id] ──────────────────────────────────────────────────────
// Restart a job: resets its state to "queued" and re-dispatches it to the AI
// backend. The job must already exist (i.e. the file was already uploaded).

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const { id: jobId } = await context.params;
  const idError = validateJobId(jobId);
  if (idError) return idError;

  const result = await requireJobOwner(jobId);
  if (result instanceof NextResponse) return result;

  const { job, userId } = result;

  // Reset to queued before dispatching so the UI reflects the restart
  // immediately rather than showing stale completed/error state.
  const restartedJob = {
    ...job,
    status: "queued" as const,
    progress: 0,
    momentsFound: 0,
    estimatedSecondsRemaining: 0,
    errorCode: undefined,
    errorMessage: undefined,
  };
  jobStore.set(jobId, restartedJob);

  // Re-dispatch to the AI backend. The job must have an objectKey stored;
  // if it does not (legacy jobs from before this change) we still reset state
  // and return success so the UI can recover gracefully.
  const objectKey = (job as Job & { objectKey?: string }).objectKey;
  if (objectKey) {
    const callbackUrl = buildCallbackUrl(request, jobId);
    await dispatchJob({
      jobId,
      userId,
      objectKey,
      contentType: (job as Job & { contentType?: string }).contentType ?? "video/mp4",
      filename: (job as Job & { filename?: string }).filename ?? `${jobId}.mp4`,
      callbackUrl,
    });
  }

  return NextResponse.json({ success: true, message: "Job restarted" });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

import type { Job } from "../shared/jobStore";

function buildCallbackUrl(request: NextRequest, jobId: string): string {
  // Derive the callback base from NEXTAUTH_URL so it points to our public
  // hostname rather than the internal container address.
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  return `${base}/api/jobs/${jobId}/callback`;
}
