/**
 * Job timeout sweep and failure recovery — Issue #1216.
 *
 * If the AI backend hangs or crashes without calling the callback endpoint,
 * a job would otherwise stay in "processing" forever. The cron endpoint calls
 * `sweepTimedOutJobs` to mark such jobs as failed and notify their owners.
 * `createRetryJob` builds a fresh job from a failed one so it can be
 * re-dispatched without a re-upload.
 */

import { randomUUID } from "crypto";
import { jobStore, type Job } from "./jobStore";
import { sendNotification } from "@/app/lib/notifications";
import { logger } from "@/app/lib/logger";

export const JOB_TIMEOUT_REASON = "AI backend did not respond within timeout";

const DEFAULT_JOB_TIMEOUT_MINUTES = 30;

export function getJobTimeoutMs(): number {
  const minutes = parseInt(process.env.JOB_TIMEOUT_MINUTES ?? "", 10);
  const safeMinutes =
    Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_JOB_TIMEOUT_MINUTES;
  return safeMinutes * 60 * 1000;
}

/** True when a job has been in "processing" longer than the timeout. */
export function isJobTimedOut(job: Job, now: number, timeoutMs: number): boolean {
  if (job.status !== "processing") return false;
  // Jobs persisted before processingStartedAt existed fall back to createdAt.
  const startedAt = job.processingStartedAt ?? job.createdAt;
  return now - startedAt > timeoutMs;
}

export interface TimeoutSweepResult {
  checked: number;
  timedOut: string[];
  notified: number;
}

export async function sweepTimedOutJobs(
  now: number = Date.now(),
  timeoutMs: number = getJobTimeoutMs(),
): Promise<TimeoutSweepResult> {
  const allJobs = await jobStore.getAll();
  const stale = allJobs.filter((job) => isJobTimedOut(job, now, timeoutMs));

  const timedOut: string[] = [];
  let notified = 0;

  for (const job of stale) {
    await jobStore.set(job.id, {
      ...job,
      status: "error",
      errorCode: "PROCESSING_TIMEOUT",
      errorMessage: JOB_TIMEOUT_REASON,
      estimatedSecondsRemaining: 0,
    });
    timedOut.push(job.id);
    logger.warn(`[cron/job-timeout] Job ${job.id} marked failed: ${JOB_TIMEOUT_REASON}`);

    try {
      await sendNotification(job.userId, "job_failed", {
        jobId: job.id,
        reason: JOB_TIMEOUT_REASON,
      });
      notified += 1;
    } catch (err) {
      // A notification failure must not undo or block the failure marking.
      logger.error(`[cron/job-timeout] Failed to notify user for job ${job.id}:`, err);
    }
  }

  return { checked: allJobs.length, timedOut, notified };
}

/**
 * Creates and persists a new queued job that reuses the failed job's source
 * video. Throws when the job cannot be retried.
 */
export async function createRetryJob(failedJob: Job): Promise<Job> {
  if (failedJob.status !== "error") {
    throw new RetryJobError("Only failed jobs can be retried", 409);
  }
  if (!failedJob.objectKey) {
    throw new RetryJobError("Job has no stored source video; please re-upload", 422);
  }

  const retryJob: Job = {
    id: randomUUID(),
    userId: failedJob.userId,
    status: "queued",
    progress: 0,
    momentsFound: 0,
    estimatedSecondsRemaining: 0,
    createdAt: Date.now(),
    objectKey: failedJob.objectKey,
    contentType: failedJob.contentType ?? "video/mp4",
    filename: failedJob.filename ?? `${failedJob.id}.mp4`,
    retriedFrom: failedJob.id,
  };

  await jobStore.set(retryJob.id, retryJob);
  return retryJob;
}

export class RetryJobError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RetryJobError";
  }
}
