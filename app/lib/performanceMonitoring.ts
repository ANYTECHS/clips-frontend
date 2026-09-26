/**
 * Performance monitoring (#882).
 *
 * One place to answer "is this slow for real users, and where". It handles
 * three things:
 *
 * 1. **Web Vitals** — LCP, CLS, INP, FCP and TTFB, reported by Next.js and
 *    rated against Google's good/needs-improvement/poor thresholds.
 * 2. **Custom metrics** — arbitrary named durations (`measure`, `startMeasure`)
 *    for work that no browser metric covers, such as a chunked upload or a
 *    dashboard fetch.
 * 3. **Fan-out** — every metric goes to Sentry as a measurement plus a
 *    breadcrumb, and to the existing analytics pipeline so it lands in the same
 *    funnels as the rest of the product telemetry.
 *
 * Everything here is safe to call on the server and in tests: reporting is a
 * no-op when `window` is undefined, and each sink is wrapped so a failing
 * transport can never take a render down with it.
 */

import * as Sentry from "@sentry/nextjs";
import analytics from "@/app/lib/analytics";
import { logger } from "@/app/lib/logger";

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** How a metric value compares against its budget. */
export type MetricRating = "good" | "needs-improvement" | "poor";

/** The Web Vitals this app reports on. */
export type WebVitalName = "LCP" | "CLS" | "INP" | "FCP" | "TTFB";

/**
 * Google's Core Web Vitals thresholds, as `[good, needs-improvement]` upper
 * bounds. A value at or below the first entry is good; at or below the second
 * is needs-improvement; anything higher is poor.
 *
 * Units are milliseconds except CLS, which is a unitless layout-shift score.
 *
 * @see https://web.dev/articles/defining-core-web-vitals-thresholds
 */
export const WEB_VITAL_THRESHOLDS: Record<WebVitalName, [number, number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

/** Budgets for app-specific metrics, in milliseconds unless noted otherwise. */
export const CUSTOM_METRIC_THRESHOLDS: Record<string, [number, number]> = {
  "dashboard.load": [1000, 3000],
  "upload.total": [30_000, 120_000],
  "upload.chunk": [5_000, 15_000],
  // CDN health metrics
  "cdn.probe": [200, 1_000],
  "cdn.purge": [500, 2_000],
  // Heap usage ratio (usedJSHeapSize / jsHeapSizeLimit), unitless 0-1 — see
  // app/hooks/useMemoryMonitor.ts.
  "memory.heapUsedRatio": [0.7, 0.9],
  "cdn.asset.resolve": [100, 500],
  // Heavy-component render timing (#render-optimization) — good is one
  // 60fps frame budget, poor is a noticeably janky commit.
  "render.ClipGrid": [16, 50],
  "render.TransactionHistoryViewer": [16, 50],
};

/**
 * Rates `value` against the budget registered for `name`.
 *
 * Falls back to "good" for metrics with no registered budget — an unbudgeted
 * metric is still worth recording, and guessing a threshold for it would make
 * the rating meaningless.
 */
export function rateMetric(name: string, value: number): MetricRating {
  const thresholds =
    WEB_VITAL_THRESHOLDS[name as WebVitalName] ?? CUSTOM_METRIC_THRESHOLDS[name];
  if (!thresholds) return "good";

  const [good, needsImprovement] = thresholds;
  if (value <= good) return "good";
  if (value <= needsImprovement) return "needs-improvement";
  return "poor";
}

// ─── Metric shape ─────────────────────────────────────────────────────────────

/** A single performance sample, ready to be sent to every sink. */
export interface PerformanceMetric {
  /** Metric name, e.g. "LCP" or "upload.total". */
  name: string;
  /** Measured value — milliseconds, except the unitless CLS score. */
  value: number;
  /** How the value compares against its budget. */
  rating: MetricRating;
  /** Unit, so a consumer does not have to special-case CLS by name. */
  unit: "millisecond" | "none";
  /** Optional dimensions, e.g. the route the sample was taken on. */
  attributes?: Record<string, string | number | boolean>;
}

const UNITLESS_METRICS = new Set(["CLS", "memory.heapUsedRatio"]);

/** CLS and ratio-style metrics are unitless scores; everything else is a duration. */
function unitFor(name: string): PerformanceMetric["unit"] {
  return UNITLESS_METRICS.has(name) ? "none" : "millisecond";
}

// ─── Sinks ────────────────────────────────────────────────────────────────────

/**
 * Run a sink, swallowing and logging anything it throws.
 *
 * Telemetry is never worth breaking a page over, and one broken transport must
 * not stop the others from receiving the metric.
 */
function safely(sinkName: string, send: () => void): void {
  try {
    send();
  } catch (error) {
    logger.warn(`[performance] ${sinkName} sink failed`, error);
  }
}

/** Send a metric to Sentry as a measurement and a breadcrumb. */
function reportToSentry(metric: PerformanceMetric): void {
  safely("sentry", () => {
    Sentry.setMeasurement?.(metric.name, metric.value, metric.unit);
    Sentry.addBreadcrumb({
      category: "performance",
      level: metric.rating === "poor" ? "warning" : "info",
      message: `${metric.name} ${Math.round(metric.value)} (${metric.rating})`,
      data: { ...metric.attributes, rating: metric.rating },
    });
  });
}

/** Send a metric through the product analytics pipeline. */
function reportToAnalytics(metric: PerformanceMetric): void {
  safely("analytics", () => {
    analytics.trackEvent("performance_metric", {
      metric: metric.name,
      // Sub-millisecond precision is noise at this granularity, but CLS needs
      // its decimals to stay meaningful.
      value: metric.unit === "none" ? metric.value : Math.round(metric.value),
      rating: metric.rating,
      ...metric.attributes,
    });
  });
}

/**
 * Surface a metric that blew its budget.
 *
 * Poor samples are the ones worth alerting on, so they are raised to Sentry as
 * a distinct, greppable message rather than being left to a dashboard query.
 */
function reportBudgetBreach(metric: PerformanceMetric): void {
  if (metric.rating !== "poor") return;

  safely("sentry-budget", () => {
    Sentry.captureMessage(`Performance budget exceeded: ${metric.name}`, {
      level: "warning",
      tags: { metric: metric.name, rating: metric.rating },
      extra: { value: metric.value, ...metric.attributes },
    });
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record one performance sample and fan it out to every sink.
 *
 * No-ops on the server: these metrics only mean anything measured in a real
 * browser, and Sentry's client transport is not available during SSR.
 */
export function reportMetric(
  name: string,
  value: number,
  attributes?: PerformanceMetric["attributes"],
): PerformanceMetric | null {
  if (typeof window === "undefined") return null;

  const metric: PerformanceMetric = {
    name,
    value,
    rating: rateMetric(name, value),
    unit: unitFor(name),
    attributes,
  };

  reportToSentry(metric);
  reportToAnalytics(metric);
  reportBudgetBreach(metric);

  return metric;
}

/**
 * Record a Web Vital delivered by Next.js's `useReportWebVitals`.
 *
 * Next reports more entries than the five tracked here (navigation timings,
 * hydration marks); anything without a budget is ignored so the metric stream
 * stays comparable across releases.
 */
export function reportWebVital(vital: {
  name: string;
  value: number;
  id?: string;
}): PerformanceMetric | null {
  if (!(vital.name in WEB_VITAL_THRESHOLDS)) return null;

  return reportMetric(vital.name, vital.value, {
    ...(vital.id ? { id: vital.id } : {}),
    ...(typeof window !== "undefined"
      ? { path: window.location.pathname }
      : {}),
  });
}

/**
 * Time a synchronous or asynchronous operation and report it as `name`.
 *
 * The duration is reported whether or not `operation` throws, so a slow failure
 * is still visible; the error itself is rethrown untouched.
 */
export async function measure<T>(
  name: string,
  operation: () => T | Promise<T>,
  attributes?: PerformanceMetric["attributes"],
): Promise<T> {
  const start = now();
  try {
    return await operation();
  } finally {
    reportMetric(name, now() - start, attributes);
  }
}

/**
 * Start a manual measurement, returning the function that ends and reports it.
 *
 * For work that does not fit inside a single callback — an upload spanning
 * several user interactions, say. Calling the returned function more than once
 * reports only the first time.
 */
export function startMeasure(
  name: string,
  attributes?: PerformanceMetric["attributes"],
): (extraAttributes?: PerformanceMetric["attributes"]) => number {
  const start = now();
  let settled = false;

  return (extraAttributes) => {
    const duration = now() - start;
    if (settled) return duration;
    settled = true;
    reportMetric(name, duration, { ...attributes, ...extraAttributes });
    return duration;
  };
}

/** High-resolution clock where available, wall clock otherwise. */
function now(): number {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}
