"use client";

import { useCallback, useRef, useState } from "react";

interface UndoRedoOptions {
  undoMessage?: string;
  redoMessage?: string;
}

export function useUndoRedo<T>(
  initial: T,
  _limit = 50,
  _options: UndoRedoOptions = {}
) {
  const [state, setState] = useState<T>(initial);
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);

  const set = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
      undoStack.current.push(prev);
      redoStack.current = [];
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (previous === undefined) return;
    setState((current) => {
      redoStack.current.push(current);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (next === undefined) return;
    setState((current) => {
      undoStack.current.push(current);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
  }, []);

  return {
    state,
    set,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    clear,
  };
}
