"use client";

/**
 * Cancellable requestAnimationFrame loop (#879).
 *
 * Hand-rolled rAF loops leak: the frame stays scheduled after unmount, and
 * keeps running while the tab is hidden, burning battery to animate pixels
 * nobody can see. This hook owns both problems.
 *
 * The callback is held in a ref, so passing an inline function does not
 * restart the loop on every render.
 */

import { useEffect, useRef } from "react";

export interface UseAnimationFrameOptions {
  /** Set false to hold the loop without unmounting the component. */
  enabled?: boolean;
  /**
   * Pause automatically while the document is hidden. On by default — a
   * background tab throttles rAF anyway, and resuming cleanly beats
   * accumulating a huge delta.
   */
  pauseWhenHidden?: boolean;
}

/**
 * Runs `callback` once per animation frame with the milliseconds elapsed since
 * the previous frame.
 *
 * The loop is cancelled on unmount, when `enabled` goes false, and while the
 * document is hidden.
 */
export function useAnimationFrame(
  callback: (deltaMs: number) => void,
  { enabled = true, pauseWhenHidden = true }: UseAnimationFrameOptions = {},
): void {
  const callbackRef = useRef(callback);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Kept current without restarting the loop.
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !window.requestAnimationFrame) return;

    const cancel = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastTimeRef.current = null;
    };

    const tick = (time: number) => {
      const last = lastTimeRef.current;
      lastTimeRef.current = time;
      // The first frame has no previous timestamp to measure against.
      if (last !== null) callbackRef.current(time - last);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(tick);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) cancel();
      else start();
    };

    if (pauseWhenHidden) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    if (!(pauseWhenHidden && document.hidden)) start();

    return () => {
      cancel();
      if (pauseWhenHidden) {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
    };
  }, [enabled, pauseWhenHidden]);
}
