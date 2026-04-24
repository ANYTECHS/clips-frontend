"use client";

/**
 * Process Zustand store (with localStorage persistence)
 *
 * Replaces the manual localStorage read/write in the old useProcessStore hook.
 * Zustand's `persist` middleware handles hydration and serialisation automatically,
 * so components no longer need to worry about SSR/hydration mismatches.
 *
 * Public API is intentionally identical to the old hook so existing call-sites
 * (ProcessDashboard, create/page.tsx) need zero changes.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ProcessState, ProcessActions, ProcessStatus } from "./types";

// ─── Default state ────────────────────────────────────────────────────────────

export const defaultProcessState: ProcessState = {
  id: "",
  label: "",
  progress: 0,
  status: "idle" as ProcessStatus,
  startedAt: null,
  completedAt: null,
  momentsFound: 0,
  estimatedSecondsRemaining: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useProcessStore = create<ProcessState & ProcessActions>()(
  persist(
    (set, get) => ({
      ...defaultProcessState,

      startProcess: (id: string, label: string) => {
        set({
          id,
          label,
          progress: 0,
          status: "processing",
          startedAt: Date.now(),
          completedAt: null,
          momentsFound: 0,
          estimatedSecondsRemaining: null,
        });
      },

      update: (
        patch:
          | Partial<ProcessState>
          | ((prev: ProcessState) => Partial<ProcessState>)
      ) => {
        set((prev) => {
          const resolved =
            typeof patch === "function" ? patch(prev) : patch;
          return { ...prev, ...resolved };
        });
      },

      resetProcess: () => {
        set(defaultProcessState);
      },
    }),
    {
      name: "clips_process_state", // same localStorage key as before
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : sessionStorage
      ),
      // Only persist the state fields, not the action functions
      partialize: (state) => ({
        id: state.id,
        label: state.label,
        progress: state.progress,
        status: state.status,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        momentsFound: state.momentsFound,
        estimatedSecondsRemaining: state.estimatedSecondsRemaining,
      }),
    }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────

/** Select the process state object (matches old hook's `process` return value) */
export const selectProcess = (
  s: ProcessState & ProcessActions
): ProcessState => ({
  id: s.id,
  label: s.label,
  progress: s.progress,
  status: s.status,
  startedAt: s.startedAt,
  completedAt: s.completedAt,
  momentsFound: s.momentsFound,
  estimatedSecondsRemaining: s.estimatedSecondsRemaining,
});

/** Select only the status — cheap subscription for status-only consumers */
export const selectProcessStatus = (s: ProcessState & ProcessActions) =>
  s.status;

/** Select only the progress value */
export const selectProcessProgress = (s: ProcessState & ProcessActions) =>
  s.progress;
