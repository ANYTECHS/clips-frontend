import { parallelLimit } from "./parallelLimit";


describe("parallelLimit", () => {
  it("returns results in input order", async () => {
    const tasks = [3, 1, 2].map((n) => () => Promise.resolve(n));
    expect(await parallelLimit(tasks, 2)).toEqual([3, 1, 2]);
  });

  it("runs at most concurrency tasks simultaneously", async () => {
    let inflight = 0;
    let maxObserved = 0;

    const tasks = Array.from({ length: 10 }, () => async () => {
      inflight++;
      maxObserved = Math.max(maxObserved, inflight);
      await Promise.resolve(); // yield
      inflight--;
      return 1;
    });

    await parallelLimit(tasks, 3);
    expect(maxObserved).toBeLessThanOrEqual(3);
  });

  it("handles concurrency larger than task count", async () => {
    const tasks = [1, 2].map((n) => () => Promise.resolve(n));
    expect(await parallelLimit(tasks, 100)).toEqual([1, 2]);
  });

  it("returns empty array for empty input", async () => {
    expect(await parallelLimit([], 5)).toEqual([]);
  });

  it("propagates task rejections", async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.reject(new Error("boom")),
      () => Promise.resolve(3),
    ];
    await expect(parallelLimit(tasks, 2)).rejects.toThrow("boom");
  });

  it("throws RangeError for concurrency < 1", async () => {
    await expect(parallelLimit([() => Promise.resolve(1)], 0)).rejects.toThrow(RangeError);
  });
});
