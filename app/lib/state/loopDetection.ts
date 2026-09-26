import { useEffect, useRef } from "react";

const MAX_UPDATES_PER_WINDOW = 50;
const WINDOW_MS = 1_000;

/**
 * Development-only guard for effects that repeatedly update the same state.
 * It reports a warning instead of changing production behaviour.
 */
export function detectStateUpdateLoop(name: string): () => void {
  if (process.env.NODE_ENV === "production") return () => undefined;

  const key = `__clipcash_state_updates_${name}`;
  const now = Date.now();
  const current = (globalThis as Record<string, unknown>)[key] as
    | { count: number; startedAt: number }
    | undefined;
  const next = current && now - current.startedAt < WINDOW_MS
    ? { count: current.count + 1, startedAt: current.startedAt }
    : { count: 1, startedAt: now };
  (globalThis as Record<string, unknown>)[key] = next;

  if (next.count === MAX_UPDATES_PER_WINDOW) {
    console.warn(
      `[ClipCash] Possible state update loop detected in ${name}. Check effect dependencies and state setters.`,
    );
  }

  return () => undefined;
}

/** Track effect executions in development without adding a production cost. */
export function useStateLoopDetection(name: string): void {
  const nameRef = useRef(name);
  useEffect(() => detectStateUpdateLoop(nameRef.current), []);
}
