/**
 * API analytics — in-memory request tracking for usage, endpoint, user and
 * performance monitoring.
 *
 * Mirrors the serverRateLimit / earningsStore pattern: a thin store backed
 * today by an in-process ring buffer (fine for single-instance / dev). Swap
 * for a time-series backend (e.g. Redis + a cron rollup, or a metrics
 * pipeline) without touching call sites.
 */

export interface ApiRequestRecord {
  /** Canonical route path, e.g. "/api/clips". */
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
  /** Authenticated user id, when available. */
  userId?: string;
  timestamp: number;
}

/** Caps memory usage — oldest records are dropped once the buffer is full. */
const MAX_RECORDS = 5000;

const records: ApiRequestRecord[] = [];

export function recordApiRequest(record: ApiRequestRecord): void {
  records.push(record);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export interface EndpointAnalytics {
  route: string;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
}

export interface UserAnalytics {
  userId: string;
  requestCount: number;
  lastSeenAt: string;
  topEndpoints: string[];
}

export interface PerformanceAnalytics {
  totalRequests: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  slowestEndpoints: { route: string; avgDurationMs: number }[];
}

export interface ApiAnalyticsSummary {
  endpoints: EndpointAnalytics[];
  users: UserAnalytics[];
  performance: PerformanceAnalytics;
  totalRequests: number;
  generatedAt: string;
}

function percentile(sortedDurations: number[], p: number): number {
  if (sortedDurations.length === 0) return 0;
  const index = Math.min(
    sortedDurations.length - 1,
    Math.ceil((p / 100) * sortedDurations.length) - 1
  );
  return sortedDurations[Math.max(0, index)];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function getEndpointAnalytics(): EndpointAnalytics[] {
  const byRoute = new Map<string, ApiRequestRecord[]>();
  for (const record of records) {
    const bucket = byRoute.get(record.route) ?? [];
    bucket.push(record);
    byRoute.set(record.route, bucket);
  }

  return Array.from(byRoute.entries())
    .map(([route, entries]) => {
      const durations = entries.map((e) => e.durationMs).sort((a, b) => a - b);
      const errorCount = entries.filter((e) => e.statusCode >= 400).length;
      return {
        route,
        requestCount: entries.length,
        errorCount,
        errorRate: entries.length ? errorCount / entries.length : 0,
        avgDurationMs: Math.round(average(durations)),
        p95DurationMs: Math.round(percentile(durations, 95)),
      };
    })
    .sort((a, b) => b.requestCount - a.requestCount);
}

export function getUserAnalytics(limit = 10): UserAnalytics[] {
  const byUser = new Map<string, ApiRequestRecord[]>();
  for (const record of records) {
    if (!record.userId) continue;
    const bucket = byUser.get(record.userId) ?? [];
    bucket.push(record);
    byUser.set(record.userId, bucket);
  }

  return Array.from(byUser.entries())
    .map(([userId, entries]) => {
      const routeCounts = new Map<string, number>();
      for (const entry of entries) {
        routeCounts.set(entry.route, (routeCounts.get(entry.route) ?? 0) + 1);
      }
      const topEndpoints = Array.from(routeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([route]) => route);
      const lastSeenAt = new Date(
        Math.max(...entries.map((e) => e.timestamp))
      ).toISOString();

      return {
        userId,
        requestCount: entries.length,
        lastSeenAt,
        topEndpoints,
      };
    })
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, limit);
}

export function getPerformanceAnalytics(): PerformanceAnalytics {
  const durations = records.map((r) => r.durationMs).sort((a, b) => a - b);
  const endpoints = getEndpointAnalytics();
  const slowestEndpoints = [...endpoints]
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, 5)
    .map(({ route, avgDurationMs }) => ({ route, avgDurationMs }));

  return {
    totalRequests: records.length,
    avgDurationMs: Math.round(average(durations)),
    p50DurationMs: Math.round(percentile(durations, 50)),
    p95DurationMs: Math.round(percentile(durations, 95)),
    p99DurationMs: Math.round(percentile(durations, 99)),
    slowestEndpoints,
  };
}

export function getApiAnalyticsSummary(): ApiAnalyticsSummary {
  return {
    endpoints: getEndpointAnalytics(),
    users: getUserAnalytics(),
    performance: getPerformanceAnalytics(),
    totalRequests: records.length,
    generatedAt: new Date().toISOString(),
  };
}

/** Exposed for testing only — clears all recorded requests. */
export function __resetApiAnalytics(): void {
  records.length = 0;
}
