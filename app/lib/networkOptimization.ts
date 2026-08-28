/**
 * Network Request Optimization (#873)
 *
 * Comprehensive network performance utilities:
 * - Request batching and deduplication
 * - Priority-based request scheduling
 * - Response compression handling
 * - Adaptive caching strategies
 * - Network condition awareness
 * - Request coalescing
 *
 * Integrates with the existing RequestCache but adds additional optimization layers.
 */

import { logger } from "./logger";
import { requestCache } from "./cache/requestCacheInstance";
import type { RequestPriority } from "./cache/RequestCache";

// ─── Network Condition Detection ──────────────────────────────────────────────

export type NetworkQuality = "4g" | "3g" | "2g" | "slow-2g" | "offline" | "unknown";
export type ConnectionType = "cellular" | "wifi" | "ethernet" | "unknown";

export interface NetworkInfo {
  /** Effective connection type */
  effectiveType: NetworkQuality;
  /** Connection technology */
  type: ConnectionType;
  /** Downlink speed in Mbps (estimate) */
  downlink?: number;
  /** Round-trip time in ms */
  rtt?: number;
  /** Whether Data Saver mode is enabled */
  saveData: boolean;
}

/**
 * Get current network conditions using Navigator Connection API.
 * Falls back to sensible defaults when API is unavailable.
 */
export function getNetworkInfo(): NetworkInfo {
  if (typeof navigator === "undefined" || !("connection" in navigator)) {
    return {
      effectiveType: "4g",
      type: "unknown",
      saveData: false,
    };
  }

  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  return {
    effectiveType: (conn?.effectiveType ?? "4g") as NetworkQuality,
    type: (conn?.type ?? "unknown") as ConnectionType,
    downlink: conn?.downlink,
    rtt: conn?.rtt,
    saveData: conn?.saveData ?? false,
  };
}

/**
 * Determine if current network is considered "slow".
 * Used to adjust caching strategy and request prioritization.
 */
export function isSlowNetwork(): boolean {
  const { effectiveType, saveData } = getNetworkInfo();
  return saveData || effectiveType === "2g" || effectiveType === "slow-2g";
}

/**
 * Watch for network condition changes and invoke callback.
 * Returns cleanup function.
 */
export function watchNetworkChanges(
  onChange: (info: NetworkInfo) => void
): () => void {
  if (typeof navigator === "undefined" || !("connection" in navigator)) {
    return () => {};
  }

  const conn = (navigator as any).connection;
  if (!conn) return () => {};

  const handler = () => onChange(getNetworkInfo());
  conn.addEventListener("change", handler);

  return () => conn.removeEventListener("change", handler);
}

// ─── Request Batching ─────────────────────────────────────────────────────────

export interface BatchConfig {
  /** Maximum time to wait before flushing batch (ms) */
  maxWaitMs: number;
  /** Maximum number of items in a batch */
  maxBatchSize: number;
  /** Minimum number of items before auto-flush */
  minBatchSize?: number;
}

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxWaitMs: 50,
  maxBatchSize: 50,
  minBatchSize: 1,
};

/**
 * Batch multiple individual requests into a single bulk request.
 * Automatically flushes based on time or size limits.
 *
 * @example
 * ```ts
 * const batcher = createRequestBatcher(
 *   async (ids) => {
 *     const res = await fetch(`/api/clips/batch?ids=${ids.join(',')}`);
 *     return res.json();
 *   },
 *   { maxWaitMs: 100, maxBatchSize: 50 }
 * );
 *
 * // These requests are automatically batched:
 * const clip1 = await batcher.add('clip-1');
 * const clip2 = await batcher.add('clip-2');
 * ```
 */
export function createRequestBatcher<TRequest, TResponse>(
  batchFn: (requests: TRequest[]) => Promise<Map<TRequest, TResponse>>,
  config: Partial<BatchConfig> = {}
): {
  add: (request: TRequest) => Promise<TResponse>;
  flush: () => Promise<void>;
  clear: () => void;
} {
  const { maxWaitMs, maxBatchSize, minBatchSize } = {
    ...DEFAULT_BATCH_CONFIG,
    ...config,
  };

  const pending = new Map<
    TRequest,
    { resolve: (value: TResponse) => void; reject: (error: unknown) => void }
  >();
  let flushTimer: NodeJS.Timeout | null = null;

  const flush = async () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    if (pending.size === 0) return;

    const requests = Array.from(pending.keys());
    const callbacks = Array.from(pending.values());
    pending.clear();

    try {
      const results = await batchFn(requests);
      
      requests.forEach((req, index) => {
        const result = results.get(req);
        if (result !== undefined) {
          callbacks[index].resolve(result);
        } else {
          callbacks[index].reject(new Error("No result for request in batch"));
        }
      });
    } catch (err) {
      // All pending requests fail together
      callbacks.forEach((cb) => cb.reject(err));
    }
  };

  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, maxWaitMs);
  };

  const add = (request: TRequest): Promise<TResponse> => {
    return new Promise((resolve, reject) => {
      pending.set(request, { resolve, reject });

      // Flush immediately if we hit max batch size
      if (pending.size >= maxBatchSize) {
        void flush();
      } else {
        scheduleFlush();
      }
    });
  };

  const clear = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    pending.forEach((cb) =>
      cb.reject(new Error("Batcher cleared before flush"))
    );
    pending.clear();
  };

  return { add, flush, clear };
}

// ─── Request Prioritization ───────────────────────────────────────────────────

/**
 * Priority queue that respects network conditions.
 * On slow networks, further deprioritizes low-priority requests.
 */
export function adaptivePriority(
  basePriority: RequestPriority
): RequestPriority {
  const networkInfo = getNetworkInfo();

  // On slow networks or with Data Saver, downgrade non-critical requests
  if (
    networkInfo.saveData ||
    networkInfo.effectiveType === "2g" ||
    networkInfo.effectiveType === "slow-2g"
  ) {
    if (basePriority === "normal") return "low";
    if (basePriority === "high") return "normal";
  }

  return basePriority;
}

/**
 * Determine request priority based on content type and viewport position.
 */
export function inferRequestPriority(options: {
  /** Is the content currently in viewport? */
  isVisible?: boolean;
  /** Is this blocking the critical rendering path? */
  isCritical?: boolean;
  /** Content type hint */
  contentType?: "image" | "data" | "analytics" | "background";
}): RequestPriority {
  if (options.isCritical || options.isVisible) return "high";
  if (options.contentType === "analytics" || options.contentType === "background") {
    return "low";
  }
  return "normal";
}

// ─── Compression Handling ─────────────────────────────────────────────────────

/**
 * Fetch with automatic compression negotiation.
 * Requests Brotli or Gzip compression if available.
 */
export async function fetchWithCompression(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);

  // Request compressed response
  if (!headers.has("Accept-Encoding")) {
    headers.set("Accept-Encoding", "br, gzip, deflate");
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Estimate compression savings for monitoring.
 * Compares Content-Length header against actual decoded size.
 */
export async function measureCompressionRatio(
  response: Response
): Promise<{ ratio: number; savedBytes: number } | null> {
  const contentLength = response.headers.get("Content-Length");
  const contentEncoding = response.headers.get("Content-Encoding");

  if (!contentLength || !contentEncoding || contentEncoding === "identity") {
    return null;
  }

  const compressedSize = parseInt(contentLength, 10);
  const clone = response.clone();
  const blob = await clone.blob();
  const decompressedSize = blob.size;

  return {
    ratio: decompressedSize / compressedSize,
    savedBytes: decompressedSize - compressedSize,
  };
}

// ─── Request Coalescing ───────────────────────────────────────────────────────

/**
 * Coalesce multiple identical requests into a single network call.
 * Similar to RequestCache deduplication but works at the request level.
 */
class RequestCoalescer {
  private inFlight = new Map<string, Promise<any>>();

  /**
   * Execute a request, sharing the promise with concurrent identical requests.
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      logger.debug(`[networkOptimization] Request coalesced: ${key}`);
      return existing;
    }

    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Cancel all in-flight requests.
   */
  clear(): void {
    this.inFlight.clear();
  }

  /**
   * Number of in-flight requests.
   */
  size(): number {
    return this.inFlight.size;
  }
}

export const requestCoalescer = new RequestCoalescer();

// ─── Adaptive Caching Strategy ────────────────────────────────────────────────

/**
 * Determine appropriate cache TTL based on network conditions.
 * Longer TTLs on slow networks to reduce requests.
 */
export function adaptiveCacheTTL(baseTTL: number): number {
  const { effectiveType, saveData } = getNetworkInfo();

  // Extend cache TTL on slow networks or with Data Saver
  if (saveData) return baseTTL * 3;
  if (effectiveType === "2g" || effectiveType === "slow-2g") return baseTTL * 2;
  if (effectiveType === "3g") return baseTTL * 1.5;

  return baseTTL;
}

/**
 * Determine if a request should use stale-while-revalidate.
 * More aggressive on slow networks.
 */
export function shouldUseStaleWhileRevalidate(
  contentType: "static" | "dynamic" | "realtime"
): boolean {
  const { effectiveType, saveData } = getNetworkInfo();

  // Always use SWR for static content
  if (contentType === "static") return true;

  // Use SWR for dynamic content on slow networks
  if (contentType === "dynamic") {
    return saveData || effectiveType === "2g" || effectiveType === "slow-2g" || effectiveType === "3g";
  }

  // Never use SWR for realtime content
  return false;
}

// ─── Request Timeout Adaptation ───────────────────────────────────────────────

/**
 * Calculate adaptive timeout based on network RTT.
 */
export function adaptiveTimeout(baseTimeout: number): number {
  const { rtt, effectiveType } = getNetworkInfo();

  // If we have RTT data, scale timeout accordingly
  if (rtt) {
    // Allow 10x RTT as a reasonable timeout multiplier
    const minTimeout = Math.max(rtt * 10, baseTimeout);
    return Math.min(minTimeout, baseTimeout * 3); // Cap at 3x base
  }

  // Otherwise use network type heuristics
  if (effectiveType === "2g" || effectiveType === "slow-2g") {
    return baseTimeout * 2;
  }

  return baseTimeout;
}

// ─── Prefetch Strategies ──────────────────────────────────────────────────────

/**
 * Intelligently prefetch resources based on user behavior and network conditions.
 */
export interface PrefetchOptions {
  /** Resources to prefetch */
  urls: string[];
  /** Only prefetch on fast networks? */
  onlyOnFastNetwork?: boolean;
  /** Delay before starting prefetch (ms) */
  delay?: number;
  /** Use idle callback if available? */
  useIdleCallback?: boolean;
}

export function prefetchResources(options: PrefetchOptions): () => void {
  const {
    urls,
    onlyOnFastNetwork = true,
    delay = 0,
    useIdleCallback = true,
  } = options;

  if (typeof window === "undefined") return () => {};

  // Skip prefetch on slow networks if requested
  if (onlyOnFastNetwork && isSlowNetwork()) {
    logger.debug("[networkOptimization] Skipping prefetch on slow network");
    return () => {};
  }

  const abortController = new AbortController();

  const doPrefetch = () => {
    urls.forEach((url) => {
      if (abortController.signal.aborted) return;

      // Use link rel=prefetch for browser-level prioritization
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = url;
      link.as = "fetch";
      document.head.appendChild(link);

      // Also warm the RequestCache
      void requestCache.fetch(
        url,
        () => fetch(url, { signal: abortController.signal }).then((r) => r.json()),
        { priority: "low" }
      );
    });
  };

  const scheduleWithDelay = () => {
    if (delay > 0) {
      setTimeout(doPrefetch, delay);
    } else {
      doPrefetch();
    }
  };

  if (useIdleCallback && "requestIdleCallback" in window) {
    requestIdleCallback(scheduleWithDelay, { timeout: 2000 });
  } else {
    scheduleWithDelay();
  }

  return () => abortController.abort();
}

// ─── Performance Monitoring ───────────────────────────────────────────────────

export interface NetworkMetrics {
  /** Total requests made */
  totalRequests: number;
  /** Requests coalesced (deduplicated) */
  coalescedRequests: number;
  /** Requests served from cache */
  cachedRequests: number;
  /** Average request duration (ms) */
  avgDuration: number;
  /** Network errors */
  errors: number;
}

class NetworkMonitor {
  private metrics: NetworkMetrics = {
    totalRequests: 0,
    coalescedRequests: 0,
    cachedRequests: 0,
    avgDuration: 0,
    errors: 0,
  };

  private durations: number[] = [];

  recordRequest(duration: number, wasCoalesced: boolean, wasCached: boolean): void {
    this.metrics.totalRequests++;
    if (wasCoalesced) this.metrics.coalescedRequests++;
    if (wasCached) this.metrics.cachedRequests++;

    this.durations.push(duration);
    if (this.durations.length > 100) this.durations.shift(); // Keep last 100

    this.metrics.avgDuration =
      this.durations.reduce((sum, d) => sum + d, 0) / this.durations.length;
  }

  recordError(): void {
    this.metrics.errors++;
  }

  getMetrics(): Readonly<NetworkMetrics> {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      totalRequests: 0,
      coalescedRequests: 0,
      cachedRequests: 0,
      avgDuration: 0,
      errors: 0,
    };
    this.durations = [];
  }
}

export const networkMonitor = new NetworkMonitor();
