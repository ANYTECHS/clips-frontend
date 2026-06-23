"use client";

/**
 * useProcessStore — compatibility re-export.
 *
 * The store has moved to app/store/processStore.ts (Zustand + persist).
 * This file keeps the old import path working so existing consumers need zero changes.
 */

import {
  useProcessStore as _useProcessStore,
  selectProcess,
  selectHasHydrated,
} from "@/app/store";
import type { ProcessState, ProcessActions } from "@/app/store";

export type { ProcessStatus, ProcessState } from "@/app/store";

export function useProcessStore() {
  const process = _useProcessStore(selectProcess);
  const hasHydrated = _useProcessStore(selectHasHydrated);
  const update = _useProcessStore((s: ProcessState & ProcessActions) => s.update);
  const startProcess = _useProcessStore((s: ProcessState & ProcessActions) => s.startProcess);
  const resetProcess = _useProcessStore((s: ProcessState & ProcessActions) => s.resetProcess);

  return { process, hasHydrated, update, startProcess, resetProcess };
}
