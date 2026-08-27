/**
 * GET /api/cron/cleanup-old-jobs
 *
 * Vercel Cron Job — runs daily at 03:00 UTC.
 *
 * Deletes terminal jobs (complete / error) older than CLEANUP_JOB_AGE_MS
 * (default 7 days) from the job store to prevent unbounded Redis/memory
 * growth. Only terminal-state jobs are removed — queued and processing jobs
 * are never touched.
 *
 * Environment variables:
 *   CRON_SECRET           — Vercel-injected secret for authorisation.
 *   CLEANUP_JOB_AGE_MS    — Age threshold in ms. Default: 604 800 000 (7 days).
 *   CLEANUP_MAX_JOBS      — Max jobs to delete per run. Default: 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { logger } from "@/app/lib/logger";

const CLEANUP_AGE_MS =
  parseInt(process.env.CLEANUP_JOB_AGE_MS ?? "604800000", 10);
const CLEANUP_MAX_JOBS =
  parseInt(process.env.CLEANUP_MAX_JOBS ?? "500", 10);

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (process.env.NODE_ENV !== "production") return true;
    logger.error("[cron/cleanup] CRON_SECRET is not set in production");
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
    logger.error("[cron/cleanup] Failed to read job store:", err);
    return NextResponse.json({ error: "Store unavailable" }, { status: 503 });
  }

  const expired = allJobs
    .filter(
      (j) =>
        (j.status === "complete" || j.status === "error") &&
        now - j.createdAt > CLEANUP_AGE_MS,
    )
    .sort((a, b) => a.createdAt - b.createdAt) // oldest first
    .slice(0, CLEANUP_MAX_JOBS);

  if (expired.length === 0) {
    logger.info("[cron/cleanup] No expired jobs to clean up");
    return NextResponse.json({ deleted: 0, checked: allJobs.length });
  }

  logger.info(`[cron/cleanup] Deleting ${expired.length} expired job(s)`);

  const results = await Promise.allSettled(
    expired.map((j) => jobStore.delete(j.id)),
  );

  const deleted = results.filter((r) => r.status === "fulfilled").length;
  const failed  = results.filter((r) => r.status === "rejected").length;

  logger.info(`[cron/cleanup] Done — deleted=${deleted} failed=${failed}`);

  return NextResponse.json({ deleted, failed, checked: allJobs.length });
}
