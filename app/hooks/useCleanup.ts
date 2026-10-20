"use client";

import { useEffect, useRef } from "react";

export type CleanupFunction = () => void;

/**
 * useCleanup pattern for managing resources in hooks.
 *
 * This hook provides a consistent pattern for cleaning up resources
 * (event listeners, timers, workers, subscriptions) when a component unmounts.
 * It's especially important for preventing memory leaks in long-running SPA sessions.
 *
 * @example
 * ```tsx
 * function useMyHook() {
 *   const { registerCleanup, executeCleanup } = useCleanup();
 *
 *   useEffect(() => {
 *     const timer = setInterval(() => {
 *       // do something
 *     }, 1000);
 *
 *     // Register cleanup function
 *     registerCleanup(() => clearInterval(timer));
 *
 *     // Or return cleanup directly (standard React pattern)
 *     return () => clearInterval(timer);
 *   }, []);
 *
 *   // Execute all cleanups manually if needed (e.g., on error)
 *   const handleReset = () => {
 *     executeCleanup();
 *   };
 *
 *   return { registerCleanup, executeCleanup };
 * }
 * ```
 */
export function useCleanup() {
  const cleanupFunctionsRef = useRef<CleanupFunction[]>([]);

  const registerCleanup = (cleanup: CleanupFunction) => {
    cleanupFunctionsRef.current.push(cleanup);
  };

  const executeCleanup = () => {
    cleanupFunctionsRef.current.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        console.error("[useCleanup] Error during cleanup:", error);
      }
    });
    cleanupFunctionsRef.current = [];
  };

  useEffect(() => {
    return () => {
      executeCleanup();
    };
  }, []);

  return {
    registerCleanup,
    executeCleanup,
  };
}

/**
 * Helper to track and cleanup event listeners.
 * Returns a function that removes the listener.
 */
export function useEventListener(
  target: EventTarget,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions
): () => void {
  useEffect(() => {
    target.addEventListener(event, handler, options);
    return () => {
      target.removeEventListener(event, handler, options);
    };
  }, [target, event, handler, options]);

  // Return manual cleanup function
  return () => {
    target.removeEventListener(event, handler, options);
  };
}

/**
 * Helper to track and cleanup intervals.
 * Returns a function that clears the interval.
 */
export function useInterval(callback: () => void, delay: number | null): () => void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (delay === null) return;

    intervalRef.current = setInterval(callback, delay);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [callback, delay]);

  return () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };
}

/**
 * Helper to track and cleanup timeouts.
 * Returns a function that clears the timeout.
 */
export function useTimeout(callback: () => void, delay: number | null): () => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (delay === null) return;

    timeoutRef.current = setTimeout(callback, delay);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [callback, delay]);

  return () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };
}
