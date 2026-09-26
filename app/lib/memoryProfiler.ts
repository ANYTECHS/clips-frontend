/**
 * Memory profiling utilities, built on the non-standard
 * `performance.memory` API (Chrome/Chromium-based browsers only — not
 * exposed by Firefox, Safari, or jsdom). Everything here degrades to `null`
 * where it isn't available rather than throwing, so it's safe to call from
 * anywhere.
 *
 * This is a *profiling* aid, not a leak detector on its own: heap size is
 * noisy (GC runs on its own schedule), so a single snapshot or even one
 * before/after diff proves little. Take several snapshots across repeated
 * mount/unmount cycles of the thing under suspicion and look at the trend
 * (`hasMonotonicGrowth`) — a heap that keeps climbing across cycles it
 * should return from is the actual signal.
 */

export interface MemorySnapshot {
  /** Bytes currently in use on the JS heap. */
  usedJSHeapSize: number;
  /** Bytes currently allocated to the JS heap (>= used). */
  totalJSHeapSize: number;
  /** The heap's upper bound, browser-defined. */
  jsHeapSizeLimit: number;
  /** `Date.now()` when the snapshot was taken. */
  takenAt: number;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function getPerformanceMemory(): PerformanceMemory | null {
  if (typeof performance === "undefined") return null;
  const memory = (performance as Performance & { memory?: PerformanceMemory }).memory;
  return memory ?? null;
}

/** Whether heap snapshots are available in this environment. */
export function isMemoryProfilingSupported(): boolean {
  return getPerformanceMemory() !== null;
}

/** Takes a heap snapshot, or `null` where `performance.memory` isn't available. */
export function takeMemorySnapshot(): MemorySnapshot | null {
  const memory = getPerformanceMemory();
  if (!memory) return null;

  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    takenAt: Date.now(),
  };
}

export interface MemorySnapshotDiff {
  deltaBytes: number;
  deltaMs: number;
  /** `usedJSHeapSize` at the end, as a fraction of `jsHeapSizeLimit`. */
  endRatio: number;
}

/** Compares two snapshots taken in that order. */
export function diffMemorySnapshots(before: MemorySnapshot, after: MemorySnapshot): MemorySnapshotDiff {
  return {
    deltaBytes: after.usedJSHeapSize - before.usedJSHeapSize,
    deltaMs: after.takenAt - before.takenAt,
    endRatio: after.jsHeapSizeLimit > 0 ? after.usedJSHeapSize / after.jsHeapSizeLimit : 0,
  };
}

/**
 * Flags a heap that grew on (almost) every sample rather than settling —
 * the shape a real leak produces across repeated mount/unmount cycles, as
 * opposed to the up-and-down noise of normal GC activity.
 *
 * `snapshots` should be taken one per cycle (e.g. after each unmount, once
 * things have had a chance to settle). `minGrowingFraction` tolerates a
 * couple of samples going down anyway (a GC pass mid-run) without losing the
 * signal.
 */
export function hasMonotonicGrowth(snapshots: MemorySnapshot[], minGrowingFraction = 0.75): boolean {
  if (snapshots.length < 3) return false;

  let growingSteps = 0;
  for (let i = 1; i < snapshots.length; i++) {
    if (snapshots[i].usedJSHeapSize > snapshots[i - 1].usedJSHeapSize) growingSteps++;
  }

  return growingSteps / (snapshots.length - 1) >= minGrowingFraction;
}
