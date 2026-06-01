"use client";

/**
 * useProcessStore — compatibility re-export.
 *
 * The store has moved to app/store/processStore.ts (Zustand + persist).
 * This file keeps the old import path working so existing consumers
 * (ProcessDashboard, create/page.tsx) need zero changes.
 *
 * The returned shape is identical to the old hook:
 *   { process, update, startProcess, resetProcess }
 */

import { useProcessStore as _useProcessStore, selectProcess, type ProcessState, type ProcessActions } from "@/app/store";

// Re-export types so existing imports from this file keep working
export type { ProcessStatus, ProcessState } from "@/app/store";

export function useProcessStore() {
  const process = _useProcessStore(selectProcess);
  const update = _useProcessStore((s: ProcessState & ProcessActions) => s.update);
  const startProcess = _useProcessStore((s: ProcessState & ProcessActions) => s.startProcess);
  const resetProcess = _useProcessStore((s: ProcessState & ProcessActions) => s.resetProcess);

  return { process, update, startProcess, resetProcess };
}
