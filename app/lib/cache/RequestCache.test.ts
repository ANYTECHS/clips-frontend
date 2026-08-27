import { RequestCache, cacheKey } from "./RequestCache";

/** Controllable clock so TTL boundaries are exact. */
function createClock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

/** A deferred promise, for driving in-flight behaviour by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("RequestCache", () => {
  describe("fetching and freshness", () => {
    it("calls the fetcher on a miss and returns its value", async () => {
      const cache = new RequestCache();
      const fetcher = jest.fn().mockResolvedValue("value");

      await expect(cache.fetch("k", fetcher)).resolves.toBe("value");
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("serves a fresh value without calling the fetcher again", async () => {
      const clock = createClock();
      const cache = new RequestCache({ ttlMs: 1_000, now: clock.now });
      const fetcher = jest.fn().mockResolvedValue("value");

      await cache.fetch("k", fetcher);
      clock.advance(999);
      await expect(cache.fetch("k", fetcher)).resolves.toBe("value");

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(cache.stats().hits).toBe(1);
    });

    it("refetches once the value is past both windows", async () => {
      const clock = createClock();
      const cache = new RequestCache({ ttlMs: 1_000, staleTtlMs: 1_000, now: clock.now });
      const fetcher = jest.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");

      await cache.fetch("k", fetcher);
      clock.advance(2_000);

      await expect(cache.fetch("k", fetcher)).resolves.toBe("second");
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("forceRefresh bypasses a fresh value", async () => {
      const cache = new RequestCache({ ttlMs: 60_000 });
      const fetcher = jest.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");

      await cache.fetch("k", fetcher);
      await expect(cache.fetch("k", fetcher, { forceRefresh: true })).resolves.toBe("second");
    });

    it("propagates a fetcher rejection and caches nothing", async () => {
      const cache = new RequestCache();
      const fetcher = jest.fn().mockRejectedValue(new Error("boom"));

      await expect(cache.fetch("k", fetcher)).rejects.toThrow("boom");
      expect(cache.peek("k")).toBeUndefined();
    });
  });

  describe("stale-while-revalidate", () => {
    it("returns the stale value immediately and refreshes behind it", async () => {
      const clock = createClock();
      const cache = new RequestCache({ ttlMs: 1_000, staleTtlMs: 10_000, now: clock.now });
      const fetcher = jest.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
      const onRevalidated = jest.fn();

      await cache.fetch("k", fetcher);
      clock.advance(2_000);

      // The caller gets the old value straight away, not the new one.
      await expect(cache.fetch("k", fetcher, { onRevalidated })).resolves.toBe("first");
      expect(cache.stats().staleHits).toBe(1);

      // Let the background refresh settle.
      await Promise.resolve();
      await Promise.resolve();

      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(onRevalidated).toHaveBeenCalledWith("second");
      expect(cache.peek("k")).toBe("second");
    });

    it("keeps the stale value when the background refresh fails", async () => {
      const clock = createClock();
      const cache = new RequestCache({ ttlMs: 1_000, staleTtlMs: 10_000, now: clock.now });
      const fetcher = jest
        .fn()
        .mockResolvedValueOnce("first")
        .mockRejectedValueOnce(new Error("network down"));
      const onRevalidateError = jest.fn();

      await cache.fetch("k", fetcher);
      clock.advance(2_000);

      await expect(cache.fetch("k", fetcher, { onRevalidateError })).resolves.toBe("first");
      await Promise.resolve();
      await Promise.resolve();

      expect(onRevalidateError).toHaveBeenCalled();
      // A slightly old number beats an error state.
      expect(cache.peek("k")).toBe("first");
    });
  });

  describe("deduplication", () => {
    it("shares one request between concurrent readers", async () => {
      const cache = new RequestCache();
      const gate = deferred<string>();
      const fetcher = jest.fn().mockReturnValue(gate.promise);

      const reads = Promise.all([
        cache.fetch("k", fetcher),
        cache.fetch("k", fetcher),
        cache.fetch("k", fetcher),
      ]);

      gate.resolve("value");
      await expect(reads).resolves.toEqual(["value", "value", "value"]);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("allows a new request once the previous one settles", async () => {
      const cache = new RequestCache({ ttlMs: 0, staleTtlMs: 0 });
      const fetcher = jest.fn().mockResolvedValue("value");

      await cache.fetch("k", fetcher);
      await cache.fetch("k", fetcher);

      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("does not leave a failed request stuck in flight", async () => {
      const cache = new RequestCache();
      const fetcher = jest
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce("recovered");

      await expect(cache.fetch("k", fetcher)).rejects.toThrow("boom");
      await expect(cache.fetch("k", fetcher)).resolves.toBe("recovered");
    });
  });

  describe("batching", () => {
    it("loads multiple missing keys with one batch request", async () => {
      const cache = new RequestCache({ ttlMs: 60_000 });
      const batchFetcher = jest.fn(async (keys: readonly string[]) =>
        new Map(keys.map((key) => [key, key.toUpperCase()])),
      );

      const result = await cache.fetchBatch(["a", "b", "c"], batchFetcher);

      expect(batchFetcher).toHaveBeenCalledTimes(1);
      expect(batchFetcher).toHaveBeenCalledWith(["a", "b", "c"]);
      expect([...result.entries()]).toEqual([["a", "A"], ["b", "B"], ["c", "C"]]);

      await cache.fetch("b", jest.fn());
      expect(cache.peek("a")).toBe("A");
      expect(cache.peek("b")).toBe("B");
      expect(cache.peek("c")).toBe("C");
    });

    it("batches only keys that are not already cached", async () => {
      const cache = new RequestCache({ ttlMs: 60_000 });
      await cache.fetch("a", async () => "A");
      const batchFetcher = jest.fn(async (keys: readonly string[]) =>
        new Map(keys.map((key) => [key, key.toUpperCase()])),
      );

      const result = await cache.fetchBatch(["a", "b"], batchFetcher);

      expect(batchFetcher).toHaveBeenCalledWith(["b"]);
      expect(result.get("a")).toBe("A");
      expect(result.get("b")).toBe("B");
    });

    it("keeps results aligned when a batch meets an in-flight read", async () => {
      const cache = new RequestCache({ ttlMs: 60_000 });
      const firstRequest = deferred<string>();
      const singleFetcher = jest.fn().mockReturnValue(firstRequest.promise);
      const firstRead = cache.fetch("a", singleFetcher);
      const batchFetcher = jest.fn(async (keys: readonly string[]) =>
        new Map(keys.map((key) => [key, key.toUpperCase()])),
      );

      const batchRead = cache.fetchBatch(["b", "a"], batchFetcher);
      firstRequest.resolve("A");

      const result = await batchRead;
      await firstRead;
      expect(result.get("b")).toBe("B");
      expect(result.get("a")).toBe("A");
      expect(batchFetcher).toHaveBeenCalledWith(["b"]);
    });

    it("rejects invalid keys and incomplete results", async () => {
      const cache = new RequestCache();
      const batchFetcher = jest.fn(async () => new Map<string, string>());

      await expect(cache.fetchBatch([], batchFetcher)).rejects.toThrow("at least one key");
      await expect(cache.fetchBatch(["a", "a"], batchFetcher)).rejects.toThrow("unique");
      await expect(cache.fetchBatch(["a"], batchFetcher)).rejects.toThrow("exactly one value");
    });
  });

  describe("size limits", () => {
    it("evicts the least recently used entry past the limit", async () => {
      const cache = new RequestCache({ maxEntries: 2, ttlMs: 60_000 });

      await cache.fetch("a", async () => "A");
      await cache.fetch("b", async () => "B");
      await cache.fetch("c", async () => "C");

      expect(cache.peek("a")).toBeUndefined();
      expect(cache.peek("b")).toBe("B");
      expect(cache.peek("c")).toBe("C");
      expect(cache.stats().evictions).toBe(1);
    });

    it("counts a read as recent use, so a re-read survives eviction", async () => {
      const cache = new RequestCache({ maxEntries: 2, ttlMs: 60_000 });

      await cache.fetch("a", async () => "A");
      await cache.fetch("b", async () => "B");
      // Touching "a" makes "b" the least recently used.
      await cache.fetch("a", async () => "A");
      await cache.fetch("c", async () => "C");

      expect(cache.peek("a")).toBe("A");
      expect(cache.peek("b")).toBeUndefined();
    });

    it("never exceeds the limit", async () => {
      const cache = new RequestCache({ maxEntries: 3, ttlMs: 60_000 });
      for (let i = 0; i < 50; i += 1) {
        await cache.fetch(`key-${i}`, async () => i);
      }
      expect(cache.stats().size).toBe(3);
    });

    it("rejects a nonsensical limit", () => {
      expect(() => new RequestCache({ maxEntries: 0 })).toThrow();
    });
  });

  describe("invalidation", () => {
    it("drops a single key", async () => {
      const cache = new RequestCache({ ttlMs: 60_000 });
      await cache.fetch("k", async () => "value");

      expect(cache.delete("k")).toBe(true);
      expect(cache.peek("k")).toBeUndefined();
      expect(cache.delete("k")).toBe(false);
    });

    it("drops every entry sharing a tag", async () => {
      const cache = new RequestCache({ ttlMs: 60_000 });
      await cache.fetch("list", async () => "L", { tags: ["projects"] });
      await cache.fetch("detail", async () => "D", { tags: ["projects", "detail"] });
      await cache.fetch("other", async () => "O", { tags: ["earnings"] });

      expect(cache.invalidateTag("projects")).toBe(2);
      expect(cache.peek("list")).toBeUndefined();
      expect(cache.peek("detail")).toBeUndefined();
      expect(cache.peek("other")).toBe("O");
    });

    it("forgets a tag once its last entry is gone", async () => {
      const cache = new RequestCache({ ttlMs: 60_000 });
      await cache.fetch("k", async () => "v", { tags: ["t"] });

      cache.delete("k");

      expect(cache.invalidateTag("t")).toBe(0);
    });

    it("drops entries matching a predicate", async () => {
      const cache = new RequestCache({ ttlMs: 60_000 });
      await cache.fetch("/api/projects/1", async () => "one");
      await cache.fetch("/api/projects/2", async () => "two");
      await cache.fetch("/api/earnings", async () => "earnings");

      expect(cache.invalidateWhere((key) => key.startsWith("/api/projects"))).toBe(2);
      expect(cache.peek("/api/earnings")).toBe("earnings");
    });

    it("clears everything", async () => {
      const cache = new RequestCache({ ttlMs: 60_000 });
      await cache.fetch("a", async () => "A", { tags: ["t"] });
      await cache.fetch("b", async () => "B");

      cache.clear();

      expect(cache.stats().size).toBe(0);
      expect(cache.invalidateTag("t")).toBe(0);
    });
  });

  describe("peek and isFresh", () => {
    it("peek never triggers a fetch", () => {
      const cache = new RequestCache();
      expect(cache.peek("missing")).toBeUndefined();
    });

    it("peek discards a fully expired entry", async () => {
      const clock = createClock();
      const cache = new RequestCache({ ttlMs: 100, staleTtlMs: 100, now: clock.now });
      await cache.fetch("k", async () => "v");

      clock.advance(500);

      expect(cache.peek("k")).toBeUndefined();
      expect(cache.stats().size).toBe(0);
    });

    it("isFresh distinguishes fresh from stale", async () => {
      const clock = createClock();
      const cache = new RequestCache({ ttlMs: 100, staleTtlMs: 10_000, now: clock.now });
      await cache.fetch("k", async () => "v");

      expect(cache.isFresh("k")).toBe(true);
      clock.advance(200);
      expect(cache.isFresh("k")).toBe(false);
      expect(cache.peek("k")).toBe("v");
    });
  });

  describe("set", () => {
    it("writes a value directly, e.g. from a mutation response", () => {
      const cache = new RequestCache({ ttlMs: 60_000 });
      cache.set("k", { id: 1 }, { tags: ["projects"] });

      expect(cache.peek("k")).toEqual({ id: 1 });
      expect(cache.invalidateTag("projects")).toBe(1);
    });

    it("replaces an existing value and its tags", () => {
      const cache = new RequestCache({ ttlMs: 60_000 });
      cache.set("k", "first", { tags: ["old"] });
      cache.set("k", "second", { tags: ["new"] });

      expect(cache.peek("k")).toBe("second");
      expect(cache.invalidateTag("old")).toBe(0);
      expect(cache.invalidateTag("new")).toBe(1);
    });
  });
});

describe("cacheKey", () => {
  it("returns the path when there are no params", () => {
    expect(cacheKey("/api/projects")).toBe("/api/projects");
  });

  it("is stable regardless of param order", () => {
    expect(cacheKey("/api/projects", { b: 2, a: 1 })).toBe(
      cacheKey("/api/projects", { a: 1, b: 2 }),
    );
  });

  it("omits null and undefined params", () => {
    expect(cacheKey("/api/projects", { page: 1, status: undefined, q: null })).toBe(
      "/api/projects?page=1",
    );
  });

  it("distinguishes different param values", () => {
    expect(cacheKey("/api/p", { page: 1 })).not.toBe(cacheKey("/api/p", { page: 2 }));
  });
});
