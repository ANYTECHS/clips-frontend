/**
 * POST /api/jobs/[id]/retry
 *
 * Retries a failed job (Issue #1216). Creates a new job that reuses the
 * failed job's stored source video and re-dispatches it to the AI backend,
 * so the user does not need to re-upload.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireJobOwner } from "../../shared/authGuard";
import { createRetryJob, RetryJobError } from "../../shared/jobTimeout";
import { checkCsrf } from "@/app/lib/csrf";
import { dispatchJob } from "@/app/lib/aiBackend";
import { logger } from "@/app/lib/logger";

const JOB_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const { id: jobId } = await context.params;
  if (!JOB_ID_RE.test(jobId)) {
    return NextResponse.json({ error: "Invalid job id format" }, { status: 400 });
  }

  const result = await requireJobOwner(jobId);
  if (result instanceof NextResponse) return result;

  let retryJob;
  try {
    retryJob = await createRetryJob(result.job);
  } catch (err) {
    if (err instanceof RetryJobError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  const dispatch = await dispatchJob({
    jobId: retryJob.id,
    userId: retryJob.userId,
    objectKey: retryJob.objectKey!,
    contentType: retryJob.contentType ?? "video/mp4",
    filename: retryJob.filename ?? `${retryJob.id}.mp4`,
    callbackUrl: `${base}/api/jobs/${retryJob.id}/callback`,
  });

  if (!dispatch.dispatched) {
    // The job stays queued; the requeue-stalled-jobs cron will pick it up.
    logger.warn(`[jobs/retry] Dispatch failed for retry job ${retryJob.id}: ${dispatch.reason}`);
  }

  return NextResponse.json(
    {
      data: { success: true, jobId: retryJob.id, retriedFrom: jobId },
      error: null,
    },
    { status: 201 },
  );
}
