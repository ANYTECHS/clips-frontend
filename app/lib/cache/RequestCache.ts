import { fetchAnalytics, type FetchAnalytics } from "./FetchAnalytics";

/**
 * A small stale-while-revalidate cache for API responses.
 *
 * The app already had three separate ad-hoc caches — a 5-minute TTL in
 * `useGlobalSearch`, another in the dashboard store, another for the XLM price
 * — each with its own expiry rule, none with a size limit, and no way to
 * invalidate one after a mutation. This is the shared mechanism they can all
 * sit on.
 *
 * What it does:
 *
 * - **Stale-while-revalidate.** Inside `ttlMs` a read is served from memory with
 *   no request at all. Past `ttlMs` but within `staleTtlMs`, the cached value is
 *   returned *immediately* and a refresh runs in the background, so a stale
 *   screen is never a blank screen. Past `staleTtlMs` the entry is gone and the
 *   caller waits for the network.
 * - **Deduplication.** Concurrent reads of the same key share one in-flight
 *   request. Three components mounting at once make one request, not three.
 * - **Bounded size.** Entries are evicted least-recently-used past `maxEntries`,
 *   so a long session browsing hundreds of clips cannot grow the cache without
 *   limit.
 * - **Tag invalidation.** An entry can carry tags; a mutation invalidates every
 *   entry sharing a tag, which is what you actually want after a write ("all
 *   project lists are stale now"), rather than naming each key.
 *
 * Deliberately not SWR or React Query. Both are excellent, but issue #873 in the
 * same change is about *removing* weight from the bundle, and this covers what
 * the app needs in a couple of kilobytes with no new dependency.
 */

export const DEFAULT_TTL_MS = 60_000;
export const DEFAULT_STALE_TTL_MS = 5 * 60_000;
export const DEFAULT_MAX_ENTRIES = 100;
export const DEFAULT_MAX_CONCURRENT = 6;

export type RequestPriority = "high" | "normal" | "low";

const PRIORITY_WEIGHT: Record<RequestPriority, number> = { high: 3, normal: 2, low: 1 };

export interface CacheEntry<T> {
  value: T;
  /** When the value was written. */
  storedAt: number;
  /** Fresh until this timestamp. */
  freshUntil: number;
  /** Servable-while-revalidating until this timestamp; dropped after. */
  staleUntil: number;
  tags: string[];
}

export interface RequestCacheOptions {
  /** How long a value is served without any network call. Default 60s. */
  ttlMs?: number;
  /** How long past `ttlMs` a value may be served while refreshing. Default 5m. */
  staleTtlMs?: number;
  /** LRU capacity. Default 100. */
  maxEntries?: number;
  /** Injectable clock for tests. */
  now?: () => number;
  /** Metrics sink for fetch performance and error tracking. */
  analytics?: FetchAnalytics;
  /** Maximum number of network requests active at once. Default 6. */
  maxConcurrent?: number;
  /** When false, expired entries are served instead of hitting the network. Default true. */
  isOnline?: () => boolean;
}

export interface FetchOptions<T> {
  /** Signal used to cancel the underlying request. */
  signal?: AbortSignal;
  /** Scheduling priority for a cache miss. Default `normal`. */
  priority?: RequestPriority;
  /** Tags to associate with this entry, for later bulk invalidation. */
  tags?: string[];
  /** Per-call TTL override. */
  ttlMs?: number;
  /** Per-call stale window override. */
  staleTtlMs?: number;
  /** Skip the cache and refetch, replacing whatever is stored. */
  forceRefresh?: boolean;
  /** Notified when a background revalidation replaces the value. */
  onRevalidated?: (value: T) => void;
  /** Notified when a background revalidation fails. The stale value is kept. */
  onRevalidateError?: (error: unknown) => void;
}

export type BatchFetcher<T> = (keys: readonly string[]) => Promise<ReadonlyMap<string, T>>;

export interface CacheStats {
  size: number;
  maxEntries: number;
  hits: number;
  misses: number;
  staleHits: number;
  inFlightHits: number;
  evictions: number;
  /** inFlightHits / (hits + misses + staleHits + inFlightHits), or 0. */
  deduplicationRate: number;
}

export class RequestCache {
  private readonly ttlMs: number;
  private readonly staleTtlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly analytics: FetchAnalytics;
  private readonly maxConcurrent: number;
  private readonly isOnlineFn: () => boolean;

  /** Insertion order doubles as LRU order: re-reading re-inserts at the end. */
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly tagIndex = new Map<string, Set<string>>();
  private readonly queue: Array<{
    key: string;
    fetcher: (signal?: AbortSignal) => Promise<unknown>;
    options: FetchOptions<unknown>;
    request: Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
    sequence: number;
  }> = [];
  private activeRequests = 0;
  private sequence = 0;

  private hits = 0;
  private misses = 0;
  private staleHits = 0;
  private inFlightHits = 0;
  private evictions = 0;

  constructor(options: RequestCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.staleTtlMs = options.staleTtlMs ?? DEFAULT_STALE_TTL_MS;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = options.now ?? Date.now;
    this.analytics = options.analytics ?? fetchAnalytics;
    this.maxConcurrent = options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
    this.isOnlineFn = options.isOnline ?? (() => true);

    if (this.maxEntries < 1) throw new Error("maxEntries must be at least 1");
    if (this.maxConcurrent < 1) throw new Error("maxConcurrent must be at least 1");
  }

  private isOffline(): boolean {
    return this.isOnlineFn() === false;
  }

  /**
   * Read `key`, fetching through `fetcher` when there is nothing fresh.
   *
   * Resolves immediately from cache when possible; a stale value resolves
   * immediately too, with the refresh continuing in the background.
   */
  async fetch<T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options: FetchOptions<T> = {},
  ): Promise<T> {
    const now = this.now();
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;

    if (entry && !options.forceRefresh) {
      if (now < entry.freshUntil) {
        this.hits += 1;
        this.analytics.record({ key, kind: "single", status: "success", cacheStatus: "hit", durationMs: 0, batchSize: 1 });
        this.touch(key, entry);
        return entry.value;
      }

      if (now < entry.staleUntil) {
        this.staleHits += 1;
        this.analytics.record({ key, kind: "single", status: "success", cacheStatus: "stale", durationMs: 0, batchSize: 1 });
        this.touch(key, entry);
        // Revalidate behind the caller's back. Failures leave the stale value
        // in place — a slightly old number beats an error state.
        if (!this.isOffline()) {
          void this.revalidate(key, fetcher, options);
        }
        return entry.value;
      }

      if (this.isOffline()) {
        this.staleHits += 1;
        this.touch(key, entry);
        return entry.value;
      }

      // Beyond the stale window the value is not usable at all.
      this.delete(key);
    }

    this.misses += 1;
    return this.load(key, fetcher, options);
  }

  /**
   * Read several keys with one batch request for the keys not already cached.
   * Results are validated before each value enters the cache.
   */
  async fetchBatch<T>(
    keys: readonly string[],
    batchFetcher: BatchFetcher<T>,
    options: FetchOptions<T> = {},
  ): Promise<ReadonlyMap<string, T>> {
    this.validateBatchKeys(keys);

    const values = new Map<string, T>();
    const pending: Array<{ key: string; request?: Promise<T> }> = [];

    for (const key of keys) {
      const entry = !options.forceRefresh
        ? (this.entries.get(key) as CacheEntry<T> | undefined)
        : undefined;

      if (entry && this.now() < entry.freshUntil) {
        this.hits += 1;
        this.analytics.record({ key, kind: "batch", status: "success", cacheStatus: "hit", durationMs: 0, batchSize: 1 });
        this.touch(key, entry);
        values.set(key, entry.value);
        continue;
      }

      const existing = this.inFlight.get(key) as Promise<T> | undefined;
      if (existing) {
        this.analytics.record({ key, kind: "batch", status: "success", cacheStatus: "in_flight", durationMs: 0, batchSize: 1 });
        pending.push({ key, request: existing });
        continue;
      }

      if (entry) this.delete(key);
      this.misses += 1;
      pending.push({ key });
    }

    const keysToLoad = pending.filter(({ request }) => !request).map(({ key }) => key);
    if (keysToLoad.length > 0) {
      const startedAt = this.now();
      const batchRequest = batchFetcher(keysToLoad).then((result) => {
        this.validateBatchResult(keysToLoad, result);
        for (const key of keysToLoad) {
          this.set(key, result.get(key) as T, options);
        }
        return result;
      });
      batchRequest.then(
        () => this.analytics.record({ key: "batch", kind: "batch", status: "success", cacheStatus: "miss", durationMs: this.now() - startedAt, batchSize: keysToLoad.length }),
        () => this.analytics.record({ key: "batch", kind: "batch", status: "error", cacheStatus: "miss", durationMs: this.now() - startedAt, batchSize: keysToLoad.length }),
      );

      for (const key of keysToLoad) {
        const keyRequest = batchRequest
          .then((result) => result.get(key) as T)
          .finally(() => {
            if (this.inFlight.get(key) === keyRequest) this.inFlight.delete(key);
          });
        this.inFlight.set(key, keyRequest);
        pending.find((item) => item.key === key)!.request = keyRequest;
      }
    }

    const pendingValues = await Promise.all(pending.map(({ request }) => request!));
    pending.forEach(({ key }, index) => values.set(key, pendingValues[index]));
    return values;
  }

  /** Read without fetching. Returns undefined when absent or fully expired. */
  peek<T>(key: string): T | undefined {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (this.now() >= entry.staleUntil) {
      this.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Whether `key` holds a value that is still fresh. */
  isFresh(key: string): boolean {
    const entry = this.entries.get(key);
    return !!entry && this.now() < entry.freshUntil;
  }

  /** Write a value directly, e.g. from a mutation response. */
  set<T>(key: string, value: T, options: Pick<FetchOptions<T>, "tags" | "ttlMs" | "staleTtlMs"> = {}): void {
    const now = this.now();
    const ttl = options.ttlMs ?? this.ttlMs;
    const staleTtl = options.staleTtlMs ?? this.staleTtlMs;

    this.delete(key);
    this.entries.set(key, {
      value,
      storedAt: now,
      freshUntil: now + ttl,
      staleUntil: now + ttl + staleTtl,
      tags: options.tags ?? [],
    });
    for (const tag of options.tags ?? []) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(key);
    }
    this.evictOverflow();
  }

  /** Drop a single entry. Returns whether anything was removed. */
  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;

    for (const tag of entry.tags) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) this.tagIndex.delete(tag);
      }
    }
    return this.entries.delete(key);
  }

  /** Drop every entry carrying `tag`. Returns how many were removed. */
  invalidateTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;
    let removed = 0;
    for (const key of [...keys]) {
      if (this.delete(key)) removed += 1;
    }
    return removed;
  }

  /** Drop every entry whose key matches `predicate`. Returns how many. */
  invalidateWhere(predicate: (key: string) => boolean): number {
    let removed = 0;
    for (const key of [...this.entries.keys()]) {
      if (predicate(key) && this.delete(key)) removed += 1;
    }
    return removed;
  }

  /** Drop everything, including in-flight bookkeeping. */
  clear(): void {
    this.entries.clear();
    this.tagIndex.clear();
    this.inFlight.clear();
  }

  stats(): CacheStats {
    const requestCount = this.hits + this.misses + this.staleHits + this.inFlightHits;
    return {
      size: this.entries.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      staleHits: this.staleHits,
      inFlightHits: this.inFlightHits,
      evictions: this.evictions,
      deduplicationRate: requestCount === 0 ? 0 : this.inFlightHits / requestCount,
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.staleHits = 0;
    this.inFlightHits = 0;
    this.evictions = 0;
  }

  /** Drop entries that have passed their fresh window (time-based invalidation). */
  invalidateStale(): number {
    const now = this.now();
    let removed = 0;
    for (const [key, entry] of [...this.entries]) {
      if (now >= entry.freshUntil && this.delete(key)) removed += 1;
    }
    return removed;
  }

  /** Read a stored value even after it has expired. Used as an offline fallback. */
  peekExpired<T>(key: string): T | undefined {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;
    return entry?.value;
  }

  /** Re-insert to move the key to the most-recently-used end of the Map. */
  private touch(key: string, entry: CacheEntry<unknown>): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private load<T>(key: string, fetcher: (signal?: AbortSignal) => Promise<T>, options: FetchOptions<T>): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      this.inFlightHits += 1;
      this.analytics.record({
        key,
        kind: "single",
        status: "success",
        cacheStatus: "in_flight",
        durationMs: 0,
        batchSize: 1,
      });
      return existing;
    }

    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const request = new Promise<T>((requestResolve, requestReject) => {
      resolve = requestResolve;
      reject = requestReject;
    });
    this.inFlight.set(key, request);
    this.queue.push({
      key,
      fetcher: fetcher as (signal?: AbortSignal) => Promise<unknown>,
      options: options as FetchOptions<unknown>,
      request,
      resolve: resolve as (value: unknown) => void,
      reject,
      sequence: this.sequence++,
    });
    this.drainQueue();
    return request;
  }

  private drainQueue(): void {
    while (this.activeRequests < this.maxConcurrent && this.queue.length > 0) {
      this.queue.sort((left, right) => {
        const priorityDifference = PRIORITY_WEIGHT[right.options.priority ?? "normal"] - PRIORITY_WEIGHT[left.options.priority ?? "normal"];
        return priorityDifference || left.sequence - right.sequence;
      });
      const queued = this.queue.shift()!;
      this.activeRequests += 1;
      const startedAt = this.now();
      let fetchResult: Promise<unknown>;
      try {
        if (queued.options.signal?.aborted) {
          throw queued.options.signal.reason ?? new DOMException("The operation was aborted", "AbortError");
        }
        fetchResult = queued.options.signal ? queued.fetcher(queued.options.signal) : queued.fetcher();
      } catch (error) {
        fetchResult = Promise.reject(error);
      }
      fetchResult
        .then((value) => {
          this.analytics.record({ key: queued.key, kind: "single", status: "success", cacheStatus: "miss", durationMs: this.now() - startedAt, batchSize: 1 });
          this.set(queued.key, value, queued.options);
          queued.resolve(value);
        })
        .catch((error) => {
          this.analytics.record({ key: queued.key, kind: "single", status: "error", cacheStatus: "miss", durationMs: this.now() - startedAt, batchSize: 1 });
          queued.reject(error);
        })
        .finally(() => {
          if (this.inFlight.get(queued.key) === queued.request) this.inFlight.delete(queued.key);
          this.activeRequests -= 1;
          this.drainQueue();
        });
    }
  }

  private async revalidate<T>(
    key: string,
    fetcher: (signal?: AbortSignal) => Promise<T>,
    options: FetchOptions<T>,
  ): Promise<void> {
    if (this.inFlight.has(key)) return;
    try {
      const value = await this.load(key, fetcher, options);
      options.onRevalidated?.(value);
    } catch (error) {
      options.onRevalidateError?.(error);
    }
  }

  private evictOverflow(): void {
    while (this.entries.size > this.maxEntries) {
      // Map iteration order is insertion order, so the first key is the LRU.
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.delete(oldest.value);
      this.evictions += 1;
    }
  }

  private validateBatchKeys(keys: readonly string[]): void {
    if (keys.length === 0) throw new Error("Batch must contain at least one key");
    const uniqueKeys = new Set(keys);
    if (uniqueKeys.size !== keys.length) throw new Error("Batch keys must be unique");
    if (keys.some((key) => typeof key !== "string" || key.length === 0)) {
      throw new Error("Batch keys must be non-empty strings");
    }
  }

  private validateBatchResult<T>(keys: readonly string[], result: ReadonlyMap<string, T>): void {
    if (!(result instanceof Map)) throw new Error("Batch fetcher must return a Map");
    if (result.size !== keys.length || keys.some((key) => !result.has(key))) {
      throw new Error("Batch fetcher must return exactly one value for every requested key");
    }
  }
}

/** Shared cache used by `useCachedFetch`. */
export const requestCache = new RequestCache();

/** Build a stable cache key from a path and query parameters. */
export function cacheKey(path: string, params?: Record<string, unknown>): string {
  if (!params) return path;
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`);
  return entries.length > 0 ? `${path}?${entries.join("&")}` : path;
}
