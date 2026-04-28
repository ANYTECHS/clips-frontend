import { NextRequest, NextResponse } from "next/server";

/**
 * Mock API endpoint for job status
 * In production, this would fetch from a real backend/database
 */

// In-memory storage for demo purposes
// Production would use Redis/Database
const jobStore = new Map<string, any>();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const jobId = params.id;

  // Check if job exists in store
  let job = jobStore.get(jobId);

  // For demo: simulate job progress if not exists
  if (!job) {
    job = {
      id: jobId,
      progress: 0,
      status: "processing",
      momentsFound: 0,
      estimatedSecondsRemaining: 300,
      createdAt: Date.now(),
    };
    jobStore.set(jobId, job);
  }

  // Simulate progress updates for demo
  if (job.status === "processing") {
    const elapsed = (Date.now() - job.createdAt) / 1000;
    
    // Simulate progress: ~30% per minute
    const newProgress = Math.min(95, Math.floor(elapsed * 0.5));
    
    if (newProgress !== job.progress) {
      job.progress = newProgress;
      job.estimatedSecondsRemaining = Math.max(0, 300 - elapsed);
      
      // Randomly find moments
      if (newProgress > 20 && job.momentsFound === 0) {
        job.momentsFound = Math.floor(Math.random() * 5) + 1;
      }
      if (newProgress > 60 && job.momentsFound < 3) {
        job.momentsFound = Math.floor(Math.random() * 8) + 3;
      }
      
      jobStore.set(jobId, job);
    }

    // Complete at 95% after a delay (simulated)
    if (newProgress >= 95 && elapsed > 180) {
      job.status = "complete";
      job.progress = 100;
      job.estimatedSecondsRemaining = 0;
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
  { params }: { params: { id: string } }
) {
  const jobId = params.id;
  const body = await request.json();

  // Update job status (for retry functionality)
  const job = jobStore.get(jobId) || {
    id: jobId,
    createdAt: Date.now(),
  };

  job.status = "processing";
  job.progress = 0;
  job.momentsFound = 0;
  job.estimatedSecondsRemaining = 300;
  
  jobStore.set(jobId, job);

  return NextResponse.json({ success: true, message: "Job restarted" });
}
