"use client";

import { useCallback, useRef, useState } from "react";

interface UndoRedoOptions {
  undoMessage?: string;
  redoMessage?: string;
}

/**
 * Hook providing undo/redo functionality for any state value.
 * Maintains history stacks and exposes reactive `canUndo`/`canRedo` flags.
 *
 * @param initial - The initial state value
 * @param limit - Maximum history depth (default: 50)
 * @returns State value and controls (set, undo, redo, clear, canUndo, canRedo)
 *
 * @example
 * const { state, set, undo, redo, canUndo, canRedo } = useUndoRedo({ x: 0, y: 0 });
 */
export function useUndoRedo<T>(
  initial: T,
  limit = 50,
  _options: UndoRedoOptions = {}
) {
  const [state, setState] = useState<T>(initial);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);

  const updateFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const set = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
      undoStack.current.push(prev);
      if (undoStack.current.length > limit) {
        undoStack.current.shift();
      }
      redoStack.current = [];
      return next;
    });
    // Defer flag update to next microtask so the ref has been updated
    queueMicrotask(updateFlags);
  }, [limit, updateFlags]);

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (previous === undefined) return;
    setState((current) => {
      redoStack.current.push(current);
      return previous;
    });
    updateFlags();
  }, [updateFlags]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (next === undefined) return;
    setState((current) => {
      undoStack.current.push(current);
      return next;
    });
    updateFlags();
  }, [updateFlags]);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    updateFlags();
  }, [updateFlags]);

  return {
    state,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
  };
}
