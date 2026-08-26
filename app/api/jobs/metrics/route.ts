import { NextResponse } from "next/server";
import { jobStore } from "../shared/jobStore";
import { requireAuth } from "../shared/authGuard";

export async function GET() {
  const authRes = await requireAuth();
  if (authRes instanceof NextResponse) return authRes;

  const jobs = await jobStore.getAll();
  const activeJobs = jobs.filter(job => job.status === "processing").length;
  const waitingJobs = jobs.filter(job => job.status === "queued").length;
  const failedJobs = jobs.filter(job => job.status === "error").length;

  return NextResponse.json({
    activeJobs,
    waitingJobs,
    failedJobs,
  });
}
