import type { ProcessStatus } from "@/app/store/types";
import { JOB_ESTIMATED_SECONDS } from "@/app/lib/constants";

interface JobStatus {
  progress: number;
  status: ProcessStatus;
  momentsFound: number;
  estimatedSecondsRemaining: number | null;
}

/**
 * Mock API endpoint for development/testing
 * This simulates a job status response
 * @param jobId - Specific job tracking reference used to identify historical storage dumps.
 * @returns Instantly wrapped async simulated progress state structure.
 */
export async function mockFetchJobStatus(jobId: string): Promise<JobStatus> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const stored = localStorage.getItem(`job_${jobId}`);
  const jobData = stored ? JSON.parse(stored) : null;

  if (!jobData) {
    return {
      progress: 0,
      status: "processing",
      momentsFound: 0,
      estimatedSecondsRemaining: JOB_ESTIMATED_SECONDS,
    };
  }

  return jobData;
}
