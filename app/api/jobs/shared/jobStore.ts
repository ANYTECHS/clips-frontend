/**
 * jobStore — persistent job state adapter.
 *
 * The exported `jobStore` object is a thin interface that today is backed by
 * an in-process Map (suitable for a single-instance dev server). In production
 * swap the backing implementation for a Redis or database adapter without
 * changing any route code.
 *
 * The AI backend writes updates by calling POST /api/jobs/[id]/callback with
 * a shared secret. Routes only _read_ from this store; they never synthesise
 * fake progress values.
 */

export type JobStatus = "queued" | "processing" | "complete" | "error";

export interface Job {
  id: string;
  /** Owner's session user id — used for authorisation. */
  userId: string;
  status: JobStatus;
  progress: number;
  momentsFound: number;
  estimatedSecondsRemaining: number;
  createdAt: number;
  /** Human-readable error message set by the AI backend on failure. */
  errorCode?: AiErrorCode;
  errorMessage?: string;
}

/**
 * Structured error codes returned by the AI backend so the UI can display
 * actionable messages rather than generic "something went wrong" copy.
 */
export type AiErrorCode =
  | "UNSUPPORTED_CODEC"
  | "VIDEO_TOO_SHORT"
  | "VIDEO_TOO_LONG"
  | "PROCESSING_TIMEOUT"
  | "INTERNAL_ERROR";

export interface JobStore {
  get(id: string): Promise<Job | null>;
  set(id: string, job: Job): Promise<void>;
  delete(id: string): Promise<boolean>;
  clear(): Promise<void>;
}

import { JobRepository, createJobRepository } from "./jobRepository";

export const jobStore: JobStore = createJobRepository();
