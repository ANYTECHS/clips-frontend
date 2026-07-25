"use client";

/**
 * Batch Transform Zustand store
 *
 * Manages the queue of AI transform jobs started from the SelectionFooter.
 * Each selected clip gets its own TransformJob entry that transitions through:
 *   queued → processing → complete | error | cancelled
 *
 * The store is intentionally NOT persisted — a transform batch is ephemeral UI
 * state. If the user navigates away, the queue is gone (the server still
 * processes jobs server-side; they can view results on next visit).
 *
 * Simulation helpers (simulateBatchProgress) are kept inside the store so the
 * UI requires no polling logic when running against the mock API.
 */

import { create } from "zustand";
import type {
  TransformJob,
  TransformJobStatus,
  TransformStyle,
  TransformOptions,
  BatchTransformState,
  BatchTransformActions,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJobId(): string {
  return `txj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Simulate per-job progress ticks. Returns a cleanup function. */
function simulateJobProgress(
  jobId: string,
  set: (fn: (state: BatchTransformState & BatchTransformActions) => Partial<BatchTransformState>) => void
): () => void {
  // Add a random start delay (0–2 s) so concurrent jobs feel staggered
  const startDelay = Math.random() * 2000;
  // Total duration: 5–12 s per clip
  const totalDuration = 5000 + Math.random() * 7000;
  const tickInterval = 400;

  let elapsed = 0;
  let timeout: ReturnType<typeof setTimeout>;
  let interval: ReturnType<typeof setInterval>;

  const tick = () => {
    elapsed += tickInterval;
    const raw = (elapsed / totalDuration) * 100;
    const progress = Math.min(98, Math.round(raw)); // never auto-reach 100

    set((state) => {
      const job = state.jobs.find((j) => j.jobId === jobId);
      // Respect cancellation — stop ticking
      if (!job || job.status === "cancelled") return {};

      const isComplete = progress >= 98 && elapsed >= totalDuration * 0.9;

      if (isComplete) {
        clearInterval(interval);
        return {
          jobs: state.jobs.map((j) =>
            j.jobId === jobId
              ? { ...j, progress: 100, status: "complete" as TransformJobStatus }
              : j
          ),
        };
      }

      return {
        jobs: state.jobs.map((j) =>
          j.jobId === jobId
            ? {
                ...j,
                progress,
                status: "processing" as TransformJobStatus,
              }
            : j
        ),
      };
    });
  };

  timeout = setTimeout(() => {
    interval = setInterval(tick, tickInterval);
  }, startDelay);

  return () => {
    clearTimeout(timeout);
    clearInterval(interval);
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: BatchTransformState = {
  jobs: [],
  isQueueOpen: false,
};

export const useBatchTransformStore = create<
  BatchTransformState & BatchTransformActions
>((set, get) => {
  // Track cleanup functions for in-progress simulations
  const cleanups = new Map<string, () => void>();

  return {
    ...initialState,

    // ── startBatch ────────────────────────────────────────────────────────────
    startBatch: (
      clipIds: string[],
      clipTitles: Record<string, string>,
      style: TransformStyle,
      options?: TransformOptions
    ) => {
      // Cancel any currently running simulations
      cleanups.forEach((cleanup) => cleanup());
      cleanups.clear();

      const newJobs: TransformJob[] = clipIds.map((clipId) => ({
        jobId: makeJobId(),
        clipId,
        clipTitle: clipTitles[clipId] ?? `Clip ${clipId}`,
        style,
        options,
        status: "queued" as TransformJobStatus,
        progress: 0,
      }));

      set({ jobs: newJobs, isQueueOpen: true });

      // Kick off simulated progress for each job
      newJobs.forEach((job) => {
        const cleanup = simulateJobProgress(job.jobId, set);
        cleanups.set(job.jobId, cleanup);
      });
    },

    // ── updateJob ─────────────────────────────────────────────────────────────
    updateJob: (jobId: string, patch: Partial<TransformJob>) => {
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.jobId === jobId ? { ...j, ...patch } : j
        ),
      }));
    },

    // ── cancelJob ─────────────────────────────────────────────────────────────
    cancelJob: (jobId: string) => {
      // Stop simulation
      cleanups.get(jobId)?.();
      cleanups.delete(jobId);

      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.jobId === jobId && (j.status === "queued" || j.status === "processing")
            ? { ...j, status: "cancelled" as TransformJobStatus }
            : j
        ),
      }));
    },

    // ── cancelAll ─────────────────────────────────────────────────────────────
    cancelAll: () => {
      cleanups.forEach((cleanup) => cleanup());
      cleanups.clear();

      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.status === "queued" || j.status === "processing"
            ? { ...j, status: "cancelled" as TransformJobStatus }
            : j
        ),
      }));
    },

    // ── clearFinished ─────────────────────────────────────────────────────────
    clearFinished: () => {
      set((state) => ({
        jobs: state.jobs.filter(
          (j) => j.status !== "complete" && j.status !== "error" && j.status !== "cancelled"
        ),
      }));
    },

    // ── toggleQueue ───────────────────────────────────────────────────────────
    toggleQueue: (open?: boolean) => {
      set((state) => ({
        isQueueOpen: open !== undefined ? open : !state.isQueueOpen,
      }));
    },
  };
});

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectJobs = (s: BatchTransformState & BatchTransformActions) =>
  s.jobs;

export const selectIsQueueOpen = (
  s: BatchTransformState & BatchTransformActions
) => s.isQueueOpen;

/** Counts of jobs in each terminal/active state — cheap for progress display */
export const selectJobCounts = (s: BatchTransformState & BatchTransformActions) => {
  const total = s.jobs.length;
  const complete = s.jobs.filter((j) => j.status === "complete").length;
  const processing = s.jobs.filter((j) => j.status === "processing").length;
  const queued = s.jobs.filter((j) => j.status === "queued").length;
  const cancelled = s.jobs.filter((j) => j.status === "cancelled").length;
  const error = s.jobs.filter((j) => j.status === "error").length;
  const active = processing + queued;
  const isDone = total > 0 && active === 0;

  return { total, complete, processing, queued, cancelled, error, active, isDone };
};
