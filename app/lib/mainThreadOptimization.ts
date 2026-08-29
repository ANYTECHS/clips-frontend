/**
 * Main thread scheduling primitives.
 *
 * `useMainThreadOptimization` (#878) is the primary consumer of these
 * utilities: non-critical work (analytics dispatch, background list
 * processing, long-task monitoring) should never compete with input
 * handling or rendering. Everything here prefers `requestIdleCallback` and
 * falls back to `setTimeout` where it's unavailable (Safari, SSR, test
 * environments).
 */

export type TaskPriority = "background" | "user-visible" | "critical";

const FALLBACK_TIMEOUT_MS: Record<TaskPriority, number> = {
  critical: 0,
  "user-visible": 16,
  background: 200,
};

function hasIdleCallback(): boolean {
  return typeof window !== "undefined" && typeof window.requestIdleCallback === "function";
}

/**
 * Schedule `fn` to run at the given priority. `critical` work runs on the
 * next tick; `user-visible` and `background` work is deferred to
 * `requestIdleCallback` so it runs when the main thread is otherwise free,
 * with a `setTimeout` fallback for environments without idle callbacks.
 * Returns a cancel function.
 */
export function scheduleWork(
  fn: () => void | Promise<void>,
  priority: TaskPriority = "user-visible",
): () => void {
  if (priority === "critical") {
    const id = setTimeout(() => void fn(), 0);
    return () => clearTimeout(id);
  }

  if (hasIdleCallback()) {
    const id = window.requestIdleCallback(() => void fn(), {
      timeout: FALLBACK_TIMEOUT_MS[priority],
    });
    return () => window.cancelIdleCallback(id);
  }

  const id = setTimeout(() => void fn(), FALLBACK_TIMEOUT_MS[priority]);
  return () => clearTimeout(id);
}

export interface LongTaskInfo {
  name: string;
  duration: number;
  attribution?: string;
}

/**
 * Observe `longtask` performance entries (tasks that block the main thread
 * for 50ms+) and report ones at or above `thresholdMs`. No-ops in
 * environments without `PerformanceObserver` or the `longtask` entry type
 * (Safari, most non-Chromium browsers). Returns a disconnect function.
 */
export function monitorLongTasks(
  callback: (tasks: LongTaskInfo[]) => void,
  thresholdMs = 50,
): () => void {
  if (typeof PerformanceObserver === "undefined") return () => {};

  try {
    const observer = new PerformanceObserver((list) => {
      const tasks = list
        .getEntries()
        .filter((entry) => entry.duration >= thresholdMs)
        .map((entry) => ({
          name: entry.name,
          duration: entry.duration,
          attribution: (entry as unknown as { attribution?: { name: string }[] }).attribution?.[0]
            ?.name,
        }));

      if (tasks.length > 0) callback(tasks);
    });

    observer.observe({ type: "longtask", buffered: true });
    return () => observer.disconnect();
  } catch {
    // "longtask" isn't a supported entry type in this browser.
    return () => {};
  }
}

const BUDGET_WINDOW_MS = 5000;
/** How much blocked time is tolerable within a rolling window before we consider the main thread "over budget". */
const BUDGET_MS = 500;

class MainThreadBudget {
  private blockedEvents: { at: number; duration: number }[] = [];

  recordBlocked(duration: number): void {
    this.blockedEvents.push({ at: Date.now(), duration });
    this.prune();
  }

  private prune(): void {
    const cutoff = Date.now() - BUDGET_WINDOW_MS;
    this.blockedEvents = this.blockedEvents.filter((event) => event.at >= cutoff);
  }

  private blockedTime(): number {
    this.prune();
    return this.blockedEvents.reduce((sum, event) => sum + event.duration, 0);
  }

  /** Percentage of the rolling window spent blocked. */
  getUtilization(): number {
    return (this.blockedTime() / BUDGET_WINDOW_MS) * 100;
  }

  isOverBudget(): boolean {
    return this.blockedTime() > BUDGET_MS;
  }

  getRemainingBudget(): number {
    return Math.max(0, BUDGET_MS - this.blockedTime());
  }
}

/** Shared budget tracker — thresholds are only meaningful relative to the whole app. */
export const mainThreadBudget = new MainThreadBudget();

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  intervalMs: number,
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = intervalMs - (now - lastRun);

    if (remaining <= 0) {
      lastRun = now;
      fn(...args);
    } else {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        lastRun = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

/**
 * Process a large array without blocking the main thread: each chunk runs
 * synchronously, then control yields back to the browser (via idle
 * callback) before the next chunk starts.
 */
export async function processInChunks<T>(
  items: T[],
  processFn: (item: T, index: number) => void | Promise<void>,
  chunkSize = 50,
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map((item, j) => processFn(item, i + j)));

    if (i + chunkSize < items.length) {
      await new Promise<void>((resolve) => scheduleWork(() => resolve(), "background"));
    }
  }
}
