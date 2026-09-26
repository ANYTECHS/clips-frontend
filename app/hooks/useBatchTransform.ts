"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTransformStore } from "@/app/store/transformStore";
import type { BatchTransformJob, BatchTransformState } from "@/app/store/types";
import type { AnimeTransformOptions } from "@/app/lib/animeTransform";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransformOptions {
  quality?: "draft" | "standard" | "high";
  resolution?: string;
  preserveAudio?: boolean;
  /** Anime-specific tuning options. Only used when style === "anime". */
  animeOptions?: AnimeTransformOptions;
}

interface BatchTransformApiResult {
  clipId: string;
  jobId: string;
  status: "queued";
  dispatched: boolean;
}

interface BatchTransformResponse {
  jobs: BatchTransformApiResult[];
}

export interface UseBatchTransformReturn {
  /** The active batch operation, or null if none has been started. */
  batch: BatchTransformState | null;
  /** True while the initial POST /api/transform/batch request is in-flight. */
  isSubmitting: boolean;
  /** Error message from the batch submission, if any. */
  submitError: string | null;
  /** Count of jobs in a terminal state (complete | error | cancelled). */
  completedCount: number;
  /** Total jobs in the current batch. */
  totalCount: number;
  /** Start a new batch transform for the given clip ids and style. */
  startBatch: (clipIds: string[], style: string, options?: TransformOptions) => Promise<void>;
  /** Cancel a single job within the batch. */
  cancelJob: (jobId: string) => void;
  /** Clear/dismiss the current batch state. */
  clearBatch: () => void;
}

// ─── CSRF helper ──────────────────────────────────────────────────────────────

async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch("/api/auth/csrf");
    if (!res.ok) return "";
    const data = (await res.json()) as { csrfToken?: string };
    return data.csrfToken ?? "";
  } catch {
    return "";
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages a batch AI video transformation operation.
 *
 * - Submits clip ids to POST /api/transform/batch.
 * - Registers each resulting job with the global transformStore.
 * - Subscribes to transformStore updates and syncs them into local batch state.
 * - Tracks per-job progress for the queue progress UI.
 * - Supports individual job cancellation (optimistic local cancel).
 *
 * @example
 * ```tsx
 * const { batch, startBatch, cancelJob, completedCount, totalCount } = useBatchTransform();
 * ```
 */
export function useBatchTransform(): UseBatchTransformReturn {
  const [batch, setBatch] = useState<BatchTransformState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Track which job ids belong to the current batch so we can sync store → batch
  const watchedJobIdsRef = useRef<Set<string>>(new Set());

  const { addJob, jobs: storeJobs } = useTransformStore();

  // ── Sync global transformStore → local batch state ──────────────────────────
  // Whenever the transform store updates a job that belongs to our batch,
  // propagate the new progress/status/resultUrl into the batch state.
  useEffect(() => {
    const watched = watchedJobIdsRef.current;
    if (watched.size === 0) return;

    setBatch((prev) => {
      if (!prev) return prev;
      let changed = false;
      const updatedJobs = { ...prev.jobs };

      for (const jobId of watched) {
        const storeJob = storeJobs[jobId];
        const batchJob = updatedJobs[jobId];
        if (!storeJob || !batchJob) continue;
        // Only sync if not locally cancelled
        if (batchJob.status === "cancelled") continue;

        const newStatus = storeJob.status as BatchTransformJob["status"];
        if (
          storeJob.progress !== batchJob.progress ||
          newStatus !== batchJob.status ||
          storeJob.resultUrl !== batchJob.resultUrl ||
          storeJob.errorMessage !== batchJob.errorMessage
        ) {
          changed = true;
          updatedJobs[jobId] = {
            ...batchJob,
            progress: storeJob.progress,
            status: newStatus,
            resultUrl: storeJob.resultUrl,
            ...(storeJob.errorMessage ? { errorMessage: storeJob.errorMessage } : {}),
          };
        }
      }

      return changed ? { ...prev, jobs: updatedJobs } : prev;
    });
  }, [storeJobs]);

  // ── Start batch ─────────────────────────────────────────────────────────────
  const startBatch = useCallback(
    async (clipIds: string[], style: string, options?: TransformOptions) => {
      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const csrfToken = await fetchCsrfToken();
        const res = await fetch("/api/transform/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify({ clipIds, style, ...(options ? { options } : {}) }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Request failed with status ${res.status}`);
        }

        const data = (await res.json()) as BatchTransformResponse;
        const now = new Date().toISOString();

        // Build initial batch state
        const batchId = `batch_${Date.now()}`;
        const jobs: Record<string, BatchTransformJob> = {};
        const newWatched = new Set<string>();

        for (const result of data.jobs) {
          jobs[result.jobId] = {
            jobId: result.jobId,
            clipId: result.clipId,
            status: result.dispatched ? "queued" : "error",
            progress: 0,
            resultUrl: null,
            ...(result.dispatched ? {} : { errorMessage: "Dispatch failed — job not queued." }),
          };

          if (result.dispatched) {
            newWatched.add(result.jobId);

            // Register in global transformStore so useTransformStatus can track it
            addJob({
              id: result.jobId,
              sourceClipId: result.clipId,
              style,
              status: "queued",
              progress: 0,
              resultUrl: null,
              createdAt: now,
              previewUrl: null,
            });
          }
        }

        watchedJobIdsRef.current = newWatched;
        setBatch({ batchId, style, jobs, createdAt: now });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Batch transform failed.";
        setSubmitError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [addJob],
  );

  // ── Cancel a single job ──────────────────────────────────────────────────────
  const cancelJob = useCallback((jobId: string) => {
    // Remove from watched set so store syncing stops for this job
    watchedJobIdsRef.current.delete(jobId);

    setBatch((prev) => {
      if (!prev) return prev;
      const existing = prev.jobs[jobId];
      if (!existing || existing.status === "complete" || existing.status === "cancelled") {
        return prev;
      }
      return {
        ...prev,
        jobs: {
          ...prev.jobs,
          [jobId]: { ...existing, status: "cancelled" },
        },
      };
    });
  }, []);

  // ── Clear the whole batch ────────────────────────────────────────────────────
  const clearBatch = useCallback(() => {
    watchedJobIdsRef.current.clear();
    setBatch(null);
    setSubmitError(null);
  }, []);

  // ── Derived counts ────────────────────────────────────────────────────────────
  const jobList = batch ? Object.values(batch.jobs) : [];
  const totalCount = jobList.length;
  const completedCount = jobList.filter(
    (j) => j.status === "complete" || j.status === "error" || j.status === "cancelled",
  ).length;

  return {
    batch,
    isSubmitting,
    submitError,
    completedCount,
    totalCount,
    startBatch,
    cancelJob,
    clearBatch,
  };
}
