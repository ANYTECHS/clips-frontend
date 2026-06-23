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
        set({ ...defaultProcessState, hasHydrated: true });
      },
    }),
    {
      name: "clips_process_state",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? secureStorage
          : {
              getItem: async (_name: string) => null,
              setItem: async (_name: string, _value: string) => {},
              removeItem: async (_name: string) => {},
            }
      ),
      partialize: (state) => ({
        id: state.id,
        label: state.label,
        progress: state.progress,
        status: state.status,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        momentsFound: state.momentsFound,
        estimatedSecondsRemaining: state.estimatedSecondsRemaining,
        // hasHydrated is runtime-only — never persisted
      }),
      // Skip automatic synchronous hydration; we drive it manually below
      // so the async decrypt has time to resolve before state is applied.
      skipHydration: true,
      onRehydrateStorage: () => (_state, error) => {
        if (!error) {
          useProcessStore.setState({ hasHydrated: true });
        }
      },
    }
  )
);

// Trigger rehydration on the client. This is called once the module is
// imported in a browser context; the persist middleware will await
// secureStorage.getItem and then apply the stored state, after which
// onRehydrateStorage fires and sets hasHydrated = true.
if (typeof window !== "undefined") {
  useProcessStore.persist.rehydrate();
}

// ─── Selectors ────────────────────────────────────────────────────────────────

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

export const selectProcessStatus = (s: ProcessState & ProcessActions) =>
  s.status;

export const selectProcessProgress = (s: ProcessState & ProcessActions) =>
  s.progress;

export const selectHasHydrated = (s: ProcessState & ProcessActions) =>
  s.hasHydrated;
