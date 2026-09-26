"use client";

/**
 * transformStore.ts — Zustand store for AI video transformation jobs.
 *
 * Tracks all in-flight and completed transformation jobs. State is persisted
 * to secureStorage so users can resume monitoring after a page reload.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secureStorage } from "@/app/lib/secureStorage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransformStatus = "queued" | "processing" | "complete" | "error";

/**
 * A single AI video transformation job.
 */
export interface TransformJob {
  /** Stable job id assigned at creation time. */
  id: string;
  /** The source clip being transformed. */
  sourceClipId: string;
  /** The visual style applied to this transformation. */
  style: string;
  /** Current lifecycle status of the transformation. */
  status: TransformStatus;
  /** Completion percentage 0–100. */
  progress: number;
  /** URL of the final transformed video (set on completion). */
  resultUrl: string | null;
  /** ISO timestamp when the job was created. */
  createdAt: string;
  /** URL of the latest preview frame (set as frames are generated). */
  previewUrl: string | null;
  /** Human-readable error message if status === "error". */
  errorMessage?: string;
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface TransformState {
  /** All known jobs keyed by their id. */
  jobs: Record<string, TransformJob>;
  /** The job currently being monitored in the UI. */
  activeJobId: string | null;
  /** True once secureStorage rehydration has completed. */
  hasHydrated: boolean;
}

interface TransformActions {
  /** Create a new job record locally and return its id. */
  addJob: (job: TransformJob) => void;
  /** Apply a partial update to an existing job. */
  updateJob: (id: string, patch: Partial<TransformJob>) => void;
  /** Remove a job from the store. */
  removeJob: (id: string) => void;
  /** Set the job that the transform progress page is monitoring. */
  setActiveJobId: (id: string | null) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTransformStore = create<TransformState & TransformActions>()(
  persist(
    (set) => ({
      jobs: {},
      activeJobId: null,
      hasHydrated: false,

      addJob: (job) =>
        set((state) => ({
          jobs: { ...state.jobs, [job.id]: job },
        })),

      updateJob: (id, patch) =>
        set((state) => {
          const existing = state.jobs[id];
          if (!existing) return state;
          return {
            jobs: { ...state.jobs, [id]: { ...existing, ...patch } },
          };
        }),

      removeJob: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.jobs;
          return { jobs: rest };
        }),

      setActiveJobId: (id) => set({ activeJobId: id }),
    }),
    {
      name: "clips_transform_state",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        jobs: state.jobs,
        activeJobId: state.activeJobId,
      }),
      skipHydration: true,
      onRehydrateStorage: () => (_state, error) => {
        if (!error) {
          useTransformStore.setState({ hasHydrated: true });
        }
      },
    },
  ),
);

if (typeof window !== "undefined") {
  useTransformStore.persist.rehydrate();
}

// ─── Selectors ────────────────────────────────────────────────────────────────

/** Select all transform jobs as an array, sorted newest-first. */
export const selectAllJobs = (s: TransformState & TransformActions): TransformJob[] =>
  Object.values(s.jobs).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

/** Select a single job by id. */
export const selectJobById =
  (id: string) =>
  (s: TransformState & TransformActions): TransformJob | undefined =>
    s.jobs[id];

/** Select the currently active job (the one being monitored). */
export const selectActiveJob = (s: TransformState & TransformActions): TransformJob | undefined =>
  s.activeJobId ? s.jobs[s.activeJobId] : undefined;

/** True once secureStorage has resolved. */
export const selectTransformHasHydrated = (s: TransformState & TransformActions): boolean =>
  s.hasHydrated;
