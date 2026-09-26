/**
 * __tests__/lib/memoryProfiler.test.ts
 */

import {
  isMemoryProfilingSupported,
  takeMemorySnapshot,
  diffMemorySnapshots,
  hasMonotonicGrowth,
  type MemorySnapshot,
} from "@/app/lib/memoryProfiler";

function setPerformanceMemory(memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | undefined) {
  Object.defineProperty(performance, "memory", {
    value: memory,
    configurable: true,
  });
}

describe("memoryProfiler", () => {
  afterEach(() => {
    // jsdom's `performance` has no `memory` property by default.
    delete (performance as any).memory;
  });

  describe("isMemoryProfilingSupported / takeMemorySnapshot", () => {
    it("reports unsupported and returns null where performance.memory is absent", () => {
      expect(isMemoryProfilingSupported()).toBe(false);
      expect(takeMemorySnapshot()).toBeNull();
    });

    it("reads a snapshot when performance.memory is present", () => {
      setPerformanceMemory({ usedJSHeapSize: 1000, totalJSHeapSize: 2000, jsHeapSizeLimit: 4000 });

      expect(isMemoryProfilingSupported()).toBe(true);
      const snapshot = takeMemorySnapshot();
      expect(snapshot).toMatchObject({ usedJSHeapSize: 1000, totalJSHeapSize: 2000, jsHeapSizeLimit: 4000 });
      expect(typeof snapshot!.takenAt).toBe("number");
    });
  });

  describe("diffMemorySnapshots", () => {
    it("computes the byte delta, time delta, and end ratio", () => {
      const before: MemorySnapshot = { usedJSHeapSize: 1000, totalJSHeapSize: 2000, jsHeapSizeLimit: 4000, takenAt: 1000 };
      const after: MemorySnapshot = { usedJSHeapSize: 1800, totalJSHeapSize: 2000, jsHeapSizeLimit: 4000, takenAt: 1500 };

      expect(diffMemorySnapshots(before, after)).toEqual({
        deltaBytes: 800,
        deltaMs: 500,
        endRatio: 0.45,
      });
    });
  });

  describe("hasMonotonicGrowth", () => {
    function snap(used: number): MemorySnapshot {
      return { usedJSHeapSize: used, totalJSHeapSize: used * 2, jsHeapSizeLimit: 100_000, takenAt: 0 };
    }

    it("returns false with fewer than 3 samples", () => {
      expect(hasMonotonicGrowth([snap(1), snap(2)])).toBe(false);
    });

    it("flags a heap that grows on (almost) every sample", () => {
      const snapshots = [snap(100), snap(200), snap(300), snap(400), snap(500)];
      expect(hasMonotonicGrowth(snapshots)).toBe(true);
    });

    it("does not flag noisy up-and-down samples typical of normal GC", () => {
      const snapshots = [snap(300), snap(150), snap(320), snap(140), snap(310)];
      expect(hasMonotonicGrowth(snapshots)).toBe(false);
    });

    it("tolerates an occasional dip without losing the growth signal", () => {
      // 4 of 5 steps grow (80%), at/above the default 75% threshold.
      const snapshots = [snap(100), snap(200), snap(180), snap(300), snap(400)];
      expect(hasMonotonicGrowth(snapshots)).toBe(true);
    });
  });
});
