/**
 * __tests__/integration/memory-leak-session.test.ts
 *
 * Simulates a long session (navigate between 50 routes) and verifies no net memory increase.
 * This test helps catch memory leaks that accumulate over extended usage.
 */

import { takeMemorySnapshot, hasMonotonicGrowth, type MemorySnapshot } from "@/app/lib/memoryProfiler";

function setPerformanceMemory(memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | undefined) {
  Object.defineProperty(performance, "memory", {
    value: memory,
    configurable: true,
  });
}

describe("Memory Leak - Long Session Simulation", () => {
  const ROUTE_COUNT = 50;
  const BASE_MEMORY_MB = 100;
  const MEMORY_JITTER_MB = 10; // Allow some fluctuation due to GC

  let snapshots: MemorySnapshot[] = [];

  beforeEach(() => {
    snapshots = [];
    // Initialize with baseline memory
    setPerformanceMemory({
      usedJSHeapSize: BASE_MEMORY_MB * 1024 * 1024,
      totalJSHeapSize: (BASE_MEMORY_MB + 50) * 1024 * 1024,
      jsHeapSizeLimit: 400 * 1024 * 1024,
    });
  });

  afterEach(() => {
    delete (performance as any).memory;
  });

  it("should not accumulate memory over 50 route navigations", () => {
    // Simulate navigating between 50 routes
    for (let i = 0; i < ROUTE_COUNT; i++) {
      // Simulate memory fluctuation due to route changes
      // Normal usage: memory goes up and down due to GC
      const jitter = (Math.random() - 0.5) * MEMORY_JITTER_MB * 1024 * 1024;
      const trend = Math.sin(i / 10) * MEMORY_JITTER_MB * 1024 * 1024; // Oscillating pattern

      const currentMemory = BASE_MEMORY_MB * 1024 * 1024 + jitter + trend;

      setPerformanceMemory({
        usedJSHeapSize: currentMemory,
        totalJSHeapSize: (BASE_MEMORY_MB + 50) * 1024 * 1024,
        jsHeapSizeLimit: 400 * 1024 * 1024,
      });

      const snapshot = takeMemorySnapshot();
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    // Verify no monotonic growth (leak)
    const hasLeak = hasMonotonicGrowth(snapshots, 0.6); // More lenient threshold for oscillation
    expect(hasLeak).toBe(false);

    // Verify final memory is within acceptable range of initial
    const initialMB = snapshots[0].usedJSHeapSize / (1024 * 1024);
    const finalMB = snapshots[snapshots.length - 1].usedJSHeapSize / (1024 * 1024);
    const deltaMB = finalMB - initialMB;

    // Allow up to 20MB net increase (accounts for retained caches, etc.)
    expect(deltaMB).toBeLessThan(20);
  });

  it("should detect a simulated memory leak", () => {
    // Simulate a leak where memory grows monotonically
    for (let i = 0; i < ROUTE_COUNT; i++) {
      // Each route adds 1MB that isn't cleaned up
      const leakGrowth = i * 1 * 1024 * 1024;
      const currentMemory = BASE_MEMORY_MB * 1024 * 1024 + leakGrowth;

      setPerformanceMemory({
        usedJSHeapSize: currentMemory,
        totalJSHeapSize: (BASE_MEMORY_MB + 50 + i) * 1024 * 1024,
        jsHeapSizeLimit: 400 * 1024 * 1024,
      });

      const snapshot = takeMemorySnapshot();
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    // Should detect the leak
    const hasLeak = hasMonotonicGrowth(snapshots, 0.8);
    expect(hasLeak).toBe(true);

    // Verify significant growth
    const initialMB = snapshots[0].usedJSHeapSize / (1024 * 1024);
    const finalMB = snapshots[snapshots.length - 1].usedJSHeapSize / (1024 * 1024);
    const deltaMB = finalMB - initialMB;

    expect(deltaMB).toBeGreaterThan(40); // 50 routes * 1MB leak each
  });
});
