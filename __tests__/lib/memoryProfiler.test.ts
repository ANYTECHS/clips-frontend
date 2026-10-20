/**
 * __tests__/lib/memoryProfiler.test.ts
 */

import {
  isMemoryProfilingSupported,
  takeMemorySnapshot,
  diffMemorySnapshots,
  hasMonotonicGrowth,
  detectLeakSources,
  trackWorker,
  getMemoryStats,
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
    delete (window as any).__trackedWorkers;
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

  describe("detectLeakSources", () => {
    it("returns empty array in non-browser environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing SSR fallback
      delete global.window;

      expect(detectLeakSources()).toEqual([]);

      global.window = originalWindow;
    });

    it("detects excessive event listeners", () => {
      // Create mock elements with event listener counts
      const div = document.createElement("div");
      (div as any).eventListenerCount = 15;

      for (let i = 0; i < 6; i++) {
        const el = document.createElement("div");
        (el as any).eventListenerCount = 15;
        document.body.appendChild(el);
      }

      const leaks = detectLeakSources();
      const listenerLeaks = leaks.filter((l) => l.type === "eventListener");
      expect(listenerLeaks.length).toBeGreaterThan(0);

      // Cleanup
      document.body.innerHTML = "";
    });

    it("detects orphaned workers", () => {
      (window as any).__trackedWorkers = [new Worker("blob:"), new Worker("blob:"), new Worker("blob:"), new Worker("blob:"), new Worker("blob:"), new Worker("blob:")];

      const leaks = detectLeakSources();
      const workerLeaks = leaks.filter((l) => l.type === "Worker");
      expect(workerLeaks.length).toBeGreaterThan(0);
      expect(workerLeaks[0].count).toBe(6);
    });
  });

  describe("trackWorker", () => {
    it("tracks workers in development", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const mockWorker = new Worker("blob:");
      trackWorker(mockWorker);

      expect((window as any).__trackedWorkers).toContain(mockWorker);

      mockWorker.terminate();
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("does not track workers in production", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const mockWorker = new Worker("blob:");
      trackWorker(mockWorker);

      expect((window as any).__trackedWorkers).toBeUndefined();

      mockWorker.terminate();
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe("getMemoryStats", () => {
    it("returns null when memory profiling is not supported", () => {
      expect(getMemoryStats()).toBeNull();
    });

    it("returns comprehensive memory stats when supported", () => {
      setPerformanceMemory({ usedJSHeapSize: 100 * 1024 * 1024, totalJSHeapSize: 200 * 1024 * 1024, jsHeapSizeLimit: 400 * 1024 * 1024 });

      const stats = getMemoryStats();
      expect(stats).not.toBeNull();
      expect(stats?.heapUsedMB).toBe(100);
      expect(stats?.heapTotalMB).toBe(200);
      expect(stats?.heapLimitMB).toBe(400);
      expect(stats?.heapUsedRatio).toBe(0.25);
      expect(stats?.domNodes).toBeGreaterThan(0);
    });
  });
});
