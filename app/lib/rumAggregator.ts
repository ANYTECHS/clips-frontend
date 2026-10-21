/**
 * In-memory Real User Monitoring aggregator (#1181).
 *
 * Browsers beacon their performance samples to `/api/rum`; this module keeps a
 * bounded rolling window per metric and summarises it into the shape the
 * performance dashboard and alerting consume. State is per server instance —
 * long-term storage stays in Sentry/analytics, this is the live view.
 */

import { rateMetric, type MetricRating } from "@/app/lib/performanceMonitoring";

/** Samples kept per metric; older ones fall off the window. */
export const RUM_WINDOW_SIZE = 500;

/** Minimum samples before a metric can raise an alert, so one bad load doesn't page. */
export const RUM_ALERT_MIN_SAMPLES = 20;

/** Alert when more than this share of samples in the window is rated `poor`. */
export const RUM_ALERT_POOR_RATIO = 0.25;

export interface RumSample {
  name: string;
  value: number;
  path?: string;
}

export interface RumMetricSummary {
  name: string;
  count: number;
  p75: number;
  /** Rating of the p75 value — the figure Core Web Vitals are judged on. */
  rating: MetricRating;
  poorRatio: number;
  alert: boolean;
}

const windows = new Map<string, number[]>();

export function recordRumSamples(samples: RumSample[]): void {
  for (const { name, value } of samples) {
    const window = windows.get(name) ?? [];
    window.push(value);
    if (window.length > RUM_WINDOW_SIZE) window.shift();
    windows.set(name, window);
  }
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

export function summarizeRum(): RumMetricSummary[] {
  return [...windows.entries()].map(([name, values]) => {
    const p75 = percentile(values, 75);
    const poorRatio = values.filter((v) => rateMetric(name, v) === "poor").length / values.length;
    return {
      name,
      count: values.length,
      p75,
      rating: rateMetric(name, p75),
      poorRatio,
      alert: values.length >= RUM_ALERT_MIN_SAMPLES && poorRatio > RUM_ALERT_POOR_RATIO,
    };
  });
}

/** Test helper — clears every window. */
export function resetRum(): void {
  windows.clear();
}
