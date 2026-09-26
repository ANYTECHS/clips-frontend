/**
 * Main Thread Optimization Hook (#878)
 *
 * Provides utilities for keeping the main thread responsive:
 * - Long task monitoring
 * - Work scheduling at different priorities
 * - Main thread budget tracking
 * - Helpers for debouncing and throttling
 */

import { useEffect, useCallback, useRef } from "react";
import {
  monitorLongTasks,
  scheduleWork,
  mainThreadBudget,
  debounce as debounceFn,
  throttle as throttleFn,
  processInChunks,
  type TaskPriority,
} from "@/app/lib/mainThreadOptimization";
import { logger } from "@/app/lib/logger";

export interface UseMainThreadOptimizationOptions {
  /** Enable long task monitoring in development */
  monitorLongTasks?: boolean;
  /** Long task threshold in ms (default 50ms) */
  longTaskThreshold?: number;
  /** Warn when long tasks exceed this duration (default 100ms) */
  warnThreshold?: number;
}

/**
 * Hook for main thread optimization utilities.
 * Provides scheduling, monitoring, and utility functions.
 * 
 * @example
 * ```tsx
 * function HeavyComponent() {
 *   const { scheduleTask, processArray, debounce, throttle } = useMainThreadOptimization({
 *     monitorLongTasks: true,
 *   });
 * 
 *   const heavyComputation = useCallback(() => {
 *     scheduleTask(
 *       () => {
 *         // Heavy work here
 *       },
 *       'background' // Low priority, won't block UI
 *     );
 *   }, [scheduleTask]);
 * 
 *   const handleScroll = debounce(() => {
 *     // Handle scroll with debouncing
 *   }, 100);
 * 
 *   return <div onScroll={handleScroll}>...</div>;
 * }
 * ```
 */
export function useMainThreadOptimization(
  options: UseMainThreadOptimizationOptions = {}
) {
  const {
    monitorLongTasks: enableMonitoring = process.env.NODE_ENV === "development",
    longTaskThreshold = 50,
    warnThreshold = 100,
  } = options;

  // Monitor long tasks in development
  useEffect(() => {
    if (!enableMonitoring) return;

    const cleanup = monitorLongTasks(
      (tasks) => {
        tasks.forEach((task) => {
          mainThreadBudget.recordBlocked(task.duration);

          if (task.duration > warnThreshold) {
            logger.warn(
              `[MainThread] Long task detected: ${task.duration.toFixed(1)}ms`,
              {
                taskName: task.name,
                attribution: task.attribution,
                isOverBudget: mainThreadBudget.isOverBudget(),
              }
            );
          }
        });

        // Log budget status if over budget
        if (mainThreadBudget.isOverBudget()) {
          logger.warn(
            `[MainThread] Over budget! Utilization: ${mainThreadBudget.getUtilization().toFixed(1)}%`,
            {
              remainingBudget: mainThreadBudget.getRemainingBudget(),
            }
          );
        }
      },
      longTaskThreshold
    );

    return cleanup;
  }, [enableMonitoring, longTaskThreshold, warnThreshold]);

  /**
   * Schedule work with given priority.
   * Returns a cancel function.
   */
  const scheduleTask = useCallback(
    (fn: () => void | Promise<void>, priority: TaskPriority = "user-visible") => {
      return scheduleWork(fn, priority);
    },
    []
  );

  /**
   * Process large arrays in chunks to avoid blocking the main thread.
   */
  const processArray = useCallback(
    async <T,>(
      items: T[],
      processFn: (item: T, index: number) => void | Promise<void>,
      chunkSize: number = 50
    ) => {
      return processInChunks(items, processFn, chunkSize);
    },
    []
  );

  /**
   * Create a debounced version of a function.
   * Note: This returns a new function on each call, so it should be used
   * with useCallback for stable references.
   */
  const debounce = useCallback(<T extends (...args: any[]) => any>(
    fn: T,
    delayMs: number
  ) => {
    return debounceFn(fn, delayMs);
  }, []);

  /**
   * Create a throttled version of a function.
   * Note: This returns a new function on each call, so it should be used
   * with useCallback for stable references.
   */
  const throttle = useCallback(<T extends (...args: any[]) => any>(
    fn: T,
    intervalMs: number
  ) => {
    return throttleFn(fn, intervalMs);
  }, []);

  return {
    /** Schedule work at a specific priority */
    scheduleTask,
    /** Process arrays in chunks without blocking */
    processArray,
    /** Create a debounced function */
    debounce,
    /** Create a throttled function */
    throttle,
    /** Check if main thread is over budget */
    isOverBudget: () => mainThreadBudget.isOverBudget(),
    /** Get current main thread utilization percentage */
    getUtilization: () => mainThreadBudget.getUtilization(),
  };
}

/**
 * Convenience hook for creating a stable debounced callback.
 * 
 * @example
 * ```tsx
 * const debouncedSearch = useDebounce((query: string) => {
 *   performSearch(query);
 * }, 300);
 * ```
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    debounceFn((...args: Parameters<T>) => callbackRef.current(...args), delayMs),
    [delayMs]
  );
}

/**
 * Convenience hook for creating a stable throttled callback.
 * 
 * @example
 * ```tsx
 * const throttledScroll = useThrottle((e: ScrollEvent) => {
 *   handleScroll(e);
 * }, 100);
 * ```
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  intervalMs: number
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    throttleFn((...args: Parameters<T>) => callbackRef.current(...args), intervalMs),
    [intervalMs]
  );
}
