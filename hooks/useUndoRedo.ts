"use client";

import { useState, useCallback, useRef } from "react";
import { useToast } from "./useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UndoRedoOptions {
  /** Toast message to show after an undo. */
  undoMessage?: string;
  /** Toast message to show after a redo. */
  redoMessage?: string;
}

export interface UseUndoRedoReturn<T> {
  /** The current state value. */
  state: T;
  /**
   * Set the state, pushing the current value onto the undo stack.
   * Accepts a new value or an updater function (like React setState).
   */
  set: (updater: T | ((prev: T) => T)) => void;
  /** Revert to the previous state. No-op if already at the oldest snapshot. */
  undo: () => void;
  /** Reapply the next state. No-op if already at the newest snapshot. */
  redo: () => void;
  /** True when there is at least one item to undo. */
  canUndo: boolean;
  /** True when there is at least one item to redo. */
  canRedo: boolean;
  /** Reset to the initial value and clear all history. */
  clear: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Generic undo/redo state manager.
 *
 * @param initialValue - The starting value.
 * @param maxHistory   - Maximum number of undo steps to keep (default: 50).
 * @param options      - Optional toast messages for undo/redo operations.
 *
 * @example
 * ```tsx
 * const { state, set, undo, redo, canUndo, canRedo, clear } = useUndoRedo<string[]>([], 50);
 * ```
 */
export function useUndoRedo<T>(
  initialValue: T,
  maxHistory = 50,
  options: UndoRedoOptions = {},
): UseUndoRedoReturn<T> {
  const { showToast } = useToast();

  // The undo stack holds snapshots of past values (oldest first).
  const undoStackRef = useRef<T[]>([]);
  // The redo stack holds values that were undone (most recent undo first).
  const redoStackRef = useRef<T[]>([]);

  const [current, setCurrent] = useState<T>(initialValue);
  // Mirror the stack lengths in state so canUndo/canRedo are reactive
  const [undoLen, setUndoLen] = useState(0);
  const [redoLen, setRedoLen] = useState(0);

  const syncLengths = useCallback(() => {
    setUndoLen(undoStackRef.current.length);
    setRedoLen(redoStackRef.current.length);
  }, []);

  const set = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setCurrent((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (prev: T) => T)(prev)
            : updater;

        // Push current value onto undo stack, trim to maxHistory
        undoStackRef.current = [
          ...undoStackRef.current.slice(-(maxHistory - 1)),
          prev,
        ];
        // Clear redo stack whenever a new value is set
        redoStackRef.current = [];
        syncLengths();

        return next;
      });
    },
    [maxHistory, syncLengths],
  );

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;

    const prev = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);

    setCurrent((current) => {
      redoStackRef.current = [...redoStackRef.current, current];
      syncLengths();
      return prev;
    });

    if (options.undoMessage) showToast(options.undoMessage, "info");
  }, [options, showToast, syncLengths]);

  const redo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return;

    const next = stack[stack.length - 1];
    redoStackRef.current = stack.slice(0, -1);

    setCurrent((current) => {
      undoStackRef.current = [...undoStackRef.current, current];
      syncLengths();
      return next;
    });

    if (options.redoMessage) showToast(options.redoMessage, "info");
  }, [options, showToast, syncLengths]);

  const clear = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCurrent(initialValue);
    syncLengths();
  }, [initialValue, syncLengths]);

  return {
    state: current,
    set,
    undo,
    redo,
    canUndo: undoLen > 0,
    canRedo: redoLen > 0,
    clear,
  };
}
