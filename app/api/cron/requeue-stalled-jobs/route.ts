/**
 * GET /api/cron/requeue-stalled-jobs
 *
 * Vercel Cron Job — runs every 5 minutes.
 *
 * Finds jobs that have been stuck in "queued" status longer than
 * STALLED_JOB_THRESHOLD_MS (default 10 minutes) and re-dispatches them to
 * the AI backend. This handles the case where a dispatch call failed
 * silently (circuit open, transient network error) and the job was never
 * picked up.
 *
 * Invocation: Vercel calls this endpoint automatically on the schedule
 * defined in vercel.json. The CRON_SECRET header is validated to prevent
 * unauthorised triggers.
 *
 * Environment variables:
 *   CRON_SECRET              — Vercel-injected secret, validated on every call.
 *   STALLED_JOB_THRESHOLD_MS — How old a "queued" job must be before being
 *                              requeued. Default: 600 000 (10 minutes).
 *   REQUEUE_MAX_JOBS         — Max jobs to requeue per run. Default: 20.
 */

import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { dispatchJob } from "@/app/lib/aiBackend";
import { logger } from "@/app/lib/logger";

const STALLED_THRESHOLD_MS =
  parseInt(process.env.STALLED_JOB_THRESHOLD_MS ?? "600000", 10);
const REQUEUE_MAX_JOBS =
  parseInt(process.env.REQUEUE_MAX_JOBS ?? "20", 10);

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // In development allow unauthenticated calls for easy local testing.
    if (process.env.NODE_ENV !== "production") return true;
    logger.error("[cron/requeue] CRON_SECRET is not set in production");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  let allJobs;

  try {
    allJobs = await jobStore.getAll();
  } catch (err) {
    logger.error("[cron/requeue] Failed to read job store:", err);
    return NextResponse.json({ error: "Store unavailable" }, { status: 503 });
  }

  // Find jobs stuck in "queued" beyond the threshold, oldest first.
  const stalled = allJobs
    .filter(
      (j) =>
        j.status === "queued" &&
        now - j.createdAt > STALLED_THRESHOLD_MS,
    )
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, REQUEUE_MAX_JOBS);

  if (stalled.length === 0) {
    logger.info("[cron/requeue] No stalled jobs found");
    return NextResponse.json({ requeued: 0, checked: allJobs.length });
  }

  logger.warn(`[cron/requeue] Found ${stalled.length} stalled job(s) — re-dispatching`);

  const callbackBase =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";

  const results = await Promise.allSettled(
    stalled.map(async (job) => {
      const result = await dispatchJob({
        jobId: job.id,
        userId: job.userId,
        // These fields are stored on the job record when created.
        objectKey: (job as typeof job & { objectKey?: string }).objectKey ?? "",
        contentType: (job as typeof job & { contentType?: string }).contentType ?? "video/mp4",
        filename: (job as typeof job & { filename?: string }).filename ?? "video",
        callbackUrl: `${callbackBase}/api/jobs/${job.id}/callback`,
      });

      if (result.dispatched) {
        logger.info(`[cron/requeue] Re-dispatched job ${job.id}`);
      } else {
        logger.warn(`[cron/requeue] Re-dispatch failed for job ${job.id}: ${result.reason}`);
      }

      return { jobId: job.id, dispatched: result.dispatched };
    }),
  );

  const dispatched = results.filter(
    (r) => r.status === "fulfilled" && r.value.dispatched,
  ).length;
  const skipped = stalled.length - dispatched;

  logger.info(`[cron/requeue] Done — dispatched=${dispatched} skipped=${skipped}`);

  return NextResponse.json({
    requeued: dispatched,
    skipped,
    checked: allJobs.length,
  });
}
