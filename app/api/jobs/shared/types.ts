export type JobStatus = "processing" | "complete" | "error";

export interface Job {
  id: string;
  progress: number;
  status: JobStatus;
  momentsFound: number;
  estimatedSecondsRemaining: number;
  createdAt: number;
}
