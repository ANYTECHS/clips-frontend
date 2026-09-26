/**
 * Rate limit monitoring — records every rate-limit decision so spikes and
 * plan-tier effectiveness can be observed without grepping server logs.
 * Same in-memory ring-buffer pattern as app/lib/apiAnalytics.ts.
 */

export interface RateLimitEvent {
  route: string;
  userId?: string;
  plan?: string;
  limit: number;
  remaining: number;
  limited: boolean;
  timestamp: number;
}

const MAX_EVENTS = 2000;
const events: RateLimitEvent[] = [];

export function recordRateLimitEvent(event: RateLimitEvent): void {
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

export interface RateLimitRouteSummary {
  route: string;
  requestCount: number;
  limitedCount: number;
  limitedRate: number;
}

export interface RateLimitPlanSummary {
  plan: string;
  requestCount: number;
  limitedCount: number;
  limitedRate: number;
}

export interface RateLimitMonitoringSummary {
  totalRequests: number;
  totalLimited: number;
  limitedRate: number;
  byRoute: RateLimitRouteSummary[];
  byPlan: RateLimitPlanSummary[];
  recentLimited: RateLimitEvent[];
}

function summarizeBy<K extends string>(
  keyOf: (event: RateLimitEvent) => K | undefined
): Map<K, { requestCount: number; limitedCount: number }> {
  const buckets = new Map<K, { requestCount: number; limitedCount: number }>();
  for (const event of events) {
    const key = keyOf(event);
    if (key === undefined) continue;
    const bucket = buckets.get(key) ?? { requestCount: 0, limitedCount: 0 };
    bucket.requestCount += 1;
    if (event.limited) bucket.limitedCount += 1;
    buckets.set(key, bucket);
  }
  return buckets;
}

export function getRateLimitMonitoringSummary(): RateLimitMonitoringSummary {
  const byRouteMap = summarizeBy((e) => e.route);
  const byPlanMap = summarizeBy((e) => e.plan ?? "unauthenticated");
  const limitedCount = events.filter((e) => e.limited).length;

  return {
    totalRequests: events.length,
    totalLimited: limitedCount,
    limitedRate: events.length ? limitedCount / events.length : 0,
    byRoute: Array.from(byRouteMap.entries())
      .map(([route, stats]) => ({
        route,
        requestCount: stats.requestCount,
        limitedCount: stats.limitedCount,
        limitedRate: stats.requestCount ? stats.limitedCount / stats.requestCount : 0,
      }))
      .sort((a, b) => b.limitedCount - a.limitedCount),
    byPlan: Array.from(byPlanMap.entries())
      .map(([plan, stats]) => ({
        plan,
        requestCount: stats.requestCount,
        limitedCount: stats.limitedCount,
        limitedRate: stats.requestCount ? stats.limitedCount / stats.requestCount : 0,
      }))
      .sort((a, b) => b.requestCount - a.requestCount),
    recentLimited: events
      .filter((e) => e.limited)
      .slice(-20)
      .reverse(),
  };
}

/** Exposed for testing only — clears all recorded events. */
export function __resetRateLimitMonitoring(): void {
  events.length = 0;
}
