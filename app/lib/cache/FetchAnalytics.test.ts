import { FetchAnalytics } from "./FetchAnalytics";
import { RequestCache } from "./RequestCache";

describe("FetchAnalytics", () => {
  it("aggregates latency, cache, batch, and error metrics", () => {
    const analytics = new FetchAnalytics();

    analytics.record({ key: "a", kind: "single", status: "success", cacheStatus: "miss", durationMs: 10, batchSize: 1 });
    analytics.record({ key: "a", kind: "single", status: "success", cacheStatus: "hit", durationMs: 0, batchSize: 1 });
    analytics.record({ key: "batch", kind: "batch", status: "error", cacheStatus: "miss", durationMs: 30, batchSize: 3 });

    expect(analytics.snapshot()).toEqual({
      total: 3,
      successes: 2,
      errors: 1,
      cacheHits: 1,
      staleHits: 0,
      inFlightShares: 0,
      batches: 1,
      batchedItems: 3,
      averageDurationMs: 40 / 3,
      p95DurationMs: 30,
      errorRate: 1 / 3,
    });
  });

  it("records cache request outcomes without exposing response data", async () => {
    const analytics = new FetchAnalytics();
    const cache = new RequestCache({ analytics, ttlMs: 60_000 });

    await cache.fetch("clip-1", async () => ({ title: "private title" }));
    await cache.fetch("clip-1", async () => ({ title: "unused" }));

    const snapshot = analytics.snapshot();
    expect(snapshot.total).toBe(2);
    expect(snapshot.cacheHits).toBe(1);
    expect(snapshot.errors).toBe(0);
  });
});