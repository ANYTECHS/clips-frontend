// Shared in-memory job storage for demo purposes
// Production would use Redis/Database

export interface Job {
  id: string;
  userId: string;
  progress: number;
  status: "processing" | "complete" | "error";
  momentsFound: number;
  estimatedSecondsRemaining: number;
  createdAt: number;
}

export const jobStore = new Map<string, Job>();
