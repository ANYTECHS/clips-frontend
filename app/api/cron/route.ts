/**
 * GET /api/cron
 *
 * Vercel Cron Job — runs every 5 minutes.
 *
 * Runs the job timeout sweep (Issue #1216): any job that has been in
 * "processing" for longer than JOB_TIMEOUT_MINUTES is marked failed with the
 * reason "AI backend did not respond within timeout", and its owner is
 * notified. Failed jobs can then be retried via POST /api/jobs/[id]/retry.
 *
 * Environment variables:
 *   CRON_SECRET          — Bearer token the scheduler presents. Required in
 *                          production.
 *   JOB_TIMEOUT_MINUTES  — How long a job may stay in "processing" before it
 *                          is considered stale. Default: 30.
 */

import { NextRequest, NextResponse } from "next/server";
import { sweepTimedOutJobs } from "@/app/api/jobs/shared/jobTimeout";
import { logger } from "@/app/lib/logger";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (process.env.NODE_ENV !== "production") return true;
    logger.error("[cron/job-timeout] CRON_SECRET is not set in production");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sweepTimedOutJobs();
    logger.info(
      `[cron/job-timeout] Done — checked=${result.checked} timedOut=${result.timedOut.length} notified=${result.notified}`,
    );
    return NextResponse.json({
      checked: result.checked,
      timedOut: result.timedOut.length,
      jobIds: result.timedOut,
      notified: result.notified,
    });
  } catch (err) {
    logger.error("[cron/job-timeout] Failed to read job store:", err);
    return NextResponse.json({ error: "Store unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request);
}
