import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "../shared/jobStore";
import { requireJobOwner } from "../shared/authGuard";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await context.params;
  const result = await requireJobOwner(jobId);
  if (result instanceof NextResponse) return result;

  let { job } = result;

  // Simulate progress updates for demo
  if (job.status === "processing") {
    const elapsed = (Date.now() - job.createdAt) / 1000;
    const newProgress = Math.min(95, Math.floor(elapsed * 0.5));

    if (newProgress !== job.progress) {
      job.progress = newProgress;
      job.estimatedSecondsRemaining = Math.max(0, 300 - elapsed);

      if (newProgress > 20 && job.momentsFound === 0) {
        job.momentsFound = Math.floor(Math.random() * 5) + 1;
      }
      if (newProgress > 60 && job.momentsFound < 3) {
        job.momentsFound = Math.floor(Math.random() * 8) + 3;
      }

      jobStore.set(jobId, job);
    }

    if (newProgress >= 95 && elapsed > 180) {
      job = { ...job, status: "complete", progress: 100, estimatedSecondsRemaining: 0 };
      jobStore.set(jobId, job);
    }
  }

  return NextResponse.json({
    progress: job.progress,
    status: job.status,
    momentsFound: job.momentsFound,
    estimatedSecondsRemaining: job.estimatedSecondsRemaining,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await context.params;
  const result = await requireJobOwner(jobId);
  if (result instanceof NextResponse) return result;

  const { job } = result;

  jobStore.set(jobId, {
    ...job,
    status: "processing",
    progress: 0,
    momentsFound: 0,
    estimatedSecondsRemaining: 300,
  });

  return NextResponse.json({ success: true, message: "Job restarted" });
}
