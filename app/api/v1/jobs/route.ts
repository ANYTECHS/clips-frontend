import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { versionedRoute } from "@/app/api/versioning";
import { requireScope, type ApiKeyRouteContext } from "@/app/lib/apiKey";

async function listJobs(_request: NextRequest, { apiKey }: ApiKeyRouteContext) {
  const jobs = await jobStore.getUserJobs(apiKey.userId);
  return NextResponse.json({
    data: jobs.map((job) => ({
      id: job.id,
      status: job.status,
      progress: job.progress,
      momentsFound: job.momentsFound,
      estimatedSecondsRemaining: job.estimatedSecondsRemaining,
      createdAt: job.createdAt,
      ...(job.errorCode ? { errorCode: job.errorCode } : {}),
      ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
    })),
  });
}

export const GET = versionedRoute("v1", requireScope("read")(listJobs));
