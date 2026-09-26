export type FetchMetricStatus = "success" | "error";
export type FetchCacheStatus = "miss" | "hit" | "stale" | "in_flight";

export interface FetchMetric {
  key: string;
  kind: "single" | "batch";
  status: FetchMetricStatus;
  cacheStatus: FetchCacheStatus;
  durationMs: number;
  batchSize: number;
}

export interface FetchAnalyticsSnapshot {
  total: number;
  successes: number;
  errors: number;
  cacheHits: number;
  staleHits: number;
  inFlightShares: number;
  batches: number;
  batchedItems: number;
  averageDurationMs: number;
  p95DurationMs: number;
  errorRate: number;
}

const MAX_SAMPLES = 1_000;

/** In-process, bounded fetch telemetry with no response or user data. */
export class FetchAnalytics {
  private readonly samples: FetchMetric[] = [];

  record(metric: FetchMetric): void {
    if (this.samples.length >= MAX_SAMPLES) this.samples.shift();
    this.samples.push({ ...metric, durationMs: Math.max(0, metric.durationMs) });
  }

  snapshot(): FetchAnalyticsSnapshot {
    const total = this.samples.length;
    const durations = this.samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
    const errors = this.samples.filter((sample) => sample.status === "error").length;
    const successes = total - errors;
    const sum = durations.reduce((totalDuration, duration) => totalDuration + duration, 0);

    return {
      total,
      successes,
      errors,
      cacheHits: this.samples.filter((sample) => sample.cacheStatus === "hit").length,
      staleHits: this.samples.filter((sample) => sample.cacheStatus === "stale").length,
      inFlightShares: this.samples.filter((sample) => sample.cacheStatus === "in_flight").length,
      batches: this.samples.filter((sample) => sample.kind === "batch").length,
      batchedItems: this.samples.reduce(
        (count, sample) => count + (sample.kind === "batch" ? sample.batchSize : 0),
        0,
      ),
      averageDurationMs: total === 0 ? 0 : sum / total,
      p95DurationMs: total === 0 ? 0 : durations[Math.min(Math.ceil(total * 0.95) - 1, total - 1)],
      errorRate: total === 0 ? 0 : errors / total,
    };
  }

  clear(): void {
    this.samples.length = 0;
  }
}

export const fetchAnalytics = new FetchAnalytics();