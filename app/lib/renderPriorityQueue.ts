/**
 * Rendering priority queue.
 *
 * Off-screen widgets (analytics cards, secondary lists, below-fold sections)
 * don't need to render on the same frame as what's actually visible. This
 * schedules that work in priority order using `requestIdleCallback` so it
 * runs when the main thread is free, falling back to `setTimeout` where idle
 * callbacks aren't available (Safari, SSR).
 *
 * ```ts
 * scheduleRender(() => setVisible(true), "high");   // above the fold
 * scheduleRender(() => setVisible(true), "low");     // below the fold
 * ```
 */

export type RenderPriority = "high" | "normal" | "low";

interface QueuedTask {
  id: number;
  priority: RenderPriority;
  run: () => void;
}

const PRIORITY_WEIGHT: Record<RenderPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

const FALLBACK_TIMEOUT_MS: Record<RenderPriority, number> = {
  high: 0,
  normal: 16,
  low: 64,
};

class RenderPriorityQueue {
  private queue: QueuedTask[] = [];
  private nextId = 0;
  private scheduled = false;

  /** Queue `run` to execute in priority order. Returns a cancel function. */
  schedule(run: () => void, priority: RenderPriority = "normal"): () => void {
    const id = this.nextId++;
    this.queue.push({ id, priority, run });
    this.queue.sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]);
    this.flush();

    return () => {
      this.queue = this.queue.filter((task) => task.id !== id);
    };
  }

  private flush(): void {
    if (this.scheduled) return;
    this.scheduled = true;

    const runNext = (deadline?: IdleDeadline) => {
      this.scheduled = false;
      const task = this.queue.shift();
      if (!task) return;

      task.run();

      if (this.queue.length > 0) {
        this.scheduled = true;
        this.requestCallback(runNext, task.priority);
      }
      void deadline;
    };

    const first = this.queue[0];
    this.requestCallback(runNext, first?.priority ?? "normal");
  }

  private requestCallback(cb: (deadline?: IdleDeadline) => void, priority: RenderPriority): void {
    if (typeof window === "undefined") {
      cb();
      return;
    }
    if (priority === "high" || typeof window.requestIdleCallback !== "function") {
      window.setTimeout(() => cb(), FALLBACK_TIMEOUT_MS[priority]);
      return;
    }
    window.requestIdleCallback(cb, { timeout: FALLBACK_TIMEOUT_MS[priority] || 50 });
  }

  /** Number of tasks still waiting. Exposed for debugging/tests. */
  size(): number {
    return this.queue.length;
  }
}

/** Shared queue for the whole app — priorities are only meaningful relative to each other. */
export const renderPriorityQueue = new RenderPriorityQueue();

/** Convenience wrapper around the shared queue. */
export function scheduleRender(run: () => void, priority: RenderPriority = "normal"): () => void {
  return renderPriorityQueue.schedule(run, priority);
}
