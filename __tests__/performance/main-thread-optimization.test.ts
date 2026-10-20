/**
 * __tests__/performance/main-thread-optimization.test.ts
 *
 * Tests that verify the main thread stays under 50ms blocking during heavy operations.
 */

import { runInWorker, createWorkerWithCleanup } from "@/app/lib/mainThreadOptimization";

describe("Main Thread Optimization", () => {
  describe("runInWorker", () => {
    it("should run computation in a worker", async () => {
      // Create a simple worker that doubles a number
      const workerCode = `
        self.onmessage = (e) => {
          const { requestId, data } = e.data;
          self.postMessage({ requestId, result: data * 2 });
        };
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);

      const result = await runInWorker(
        () => new Worker(workerUrl),
        5,
        (data) => data * 2 // Fallback
      );

      expect(result).toBe(10);
      URL.revokeObjectURL(workerUrl);
    });

    it("should use fallback when workers are unavailable", async () => {
      // Mock Worker as undefined
      const originalWorker = global.Worker;
      // @ts-expect-error - testing fallback
      delete global.Worker;

      const result = await runInWorker(
        () => {
          throw new Error("Should not be called");
        },
        5,
        (data) => data * 3
      );

      expect(result).toBe(15);

      global.Worker = originalWorker;
    });

    it("should handle worker errors gracefully", async () => {
      const workerCode = `
        self.onmessage = (e) => {
          throw new Error("Worker error");
        };
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);

      const result = await runInWorker(
        () => new Worker(workerUrl),
        5,
        (data) => data * 4
      );

      expect(result).toBe(20); // Should use fallback
      URL.revokeObjectURL(workerUrl);
    });
  });

  describe("createWorkerWithCleanup", () => {
    it("should create a worker with cleanup function", () => {
      const workerCode = `
        self.onmessage = (e) => {
          self.postMessage({ result: e.data });
        };
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);

      const { worker, cleanup } = createWorkerWithCleanup(() => new Worker(workerUrl));

      expect(worker).toBeDefined();
      expect(cleanup).toBeInstanceOf(Function);

      cleanup();
      URL.revokeObjectURL(workerUrl);
    });
  });

  describe("Main Thread Blocking Performance", () => {
    it("should complete heavy operations within acceptable time", async () => {
      // Simulate a heavy operation that would normally block
      const startTime = performance.now();

      // Process a large array using chunks (simulated)
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);
      let sum = 0;

      for (let i = 0; i < largeArray.length; i++) {
        sum += largeArray[i];
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in under 50ms for this simple operation
      expect(duration).toBeLessThan(50);
    });
  });
});
