"use client";

/**
 * Process Zustand store (with secureStorage persistence)
 *
 * secureStorage is fully async (AES-GCM), so we use skipHydration: true and
 * manually call rehydrate() after the async getItem resolves. A hasHydrated
 * flag lets components show a loading state until the store is ready.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ProcessState, ProcessActions, ProcessStatus } from "./types";
import { secureStorage } from "@/app/lib/secureStorage";

// ─── Default state ────────────────────────────────────────────────────────────

/**
 * Default fallback structural blueprint values for tracking asynchronous processing lifecycles.
 */
export const defaultProcessState: ProcessState = {
  id: "",
  label: "",
  progress: 0,
  status: "idle" as ProcessStatus,
  startedAt: null,
  completedAt: null,
  momentsFound: 0,
  estimatedSecondsRemaining: null,
  hasHydrated: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Reactive state store container managing media compilation steps and encrypted persistence hydration.
 */
export const useProcessStore = create<ProcessState & ProcessActions>()(
  persist(
    (set, get) => ({
      ...defaultProcessState,

      startProcess: (id: string, label: string): string => {
        if (!id) {
          if (process.env.NODE_ENV === "development") {
            console.warn("useProcessStore.startProcess: no id provided, auto-generating one.");
          }
          id = crypto.randomUUID();
        }
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
        return id;
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
        set({ ...defaultProcessState, hasHydrated: true });
      },
    }),
    {
      name: "clips_process_state",
      storage: createJSONStorage(() => secureStorage),
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
      skipHydration: true,
      onRehydrateStorage: () => (_state, error) => {
        if (!error) {
          useProcessStore.setState({ hasHydrated: true });
        }
      },
    }
  )
);

if (typeof window !== "undefined") {
  useProcessStore.persist.rehydrate();
}

// ─── Selectors ────────────────────────────────────────────────────────────────

/**
 * Selects the entire transactional lifecycle process state block configuration profile.
 *
 * @param s - Combined global process store data slice object.
 * @returns Consolidated status structure parameters tracking in-flight pipelines.
 */
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
  hasHydrated: s.hasHydrated,
});

/**
 * Extract operational lifecycle status descriptors from the process engine.
 *
 * @param s - Combined global process store data slice object.
 * @returns Current state phase token ("idle" | "processing" | "success" | "error").
 */
export const selectProcessStatus = (s: ProcessState & ProcessActions) =>
  s.status;

/**
 * Track current numerical completion progress indices inside processing pipelines.
 *
 * @param s - Combined global process store data slice object.
 * @returns Quantified progress magnitude ratio ranging from 0 up to 100.
 */
export const selectProcessProgress = (s: ProcessState & ProcessActions) =>
  s.progress;

/**
 * Evaluates whether state restoration routines from async storage nodes completed.
 *
 * @param s - Combined global process store data slice object.
 * @returns True if underlying storage engine has resolved historical cached records.
 */
export const selectHasHydrated = (s: ProcessState & ProcessActions) =>
  s.hasHydrated;
