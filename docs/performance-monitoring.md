# Performance monitoring

Real-user performance instrumentation for the app (issue #882).

## What is collected

| Metric | Source | Budget (good / needs-improvement) |
| --- | --- | --- |
| `LCP` | Web Vitals | 2500ms / 4000ms |
| `CLS` | Web Vitals | 0.1 / 0.25 (unitless) |
| `INP` | Web Vitals | 200ms / 500ms |
| `FCP` | Web Vitals | 1800ms / 3000ms |
| `TTFB` | Web Vitals | 800ms / 1800ms |
| `dashboard.load` | custom | 1000ms / 3000ms |
| `upload.total` | custom | 30s / 120s |
| `upload.chunk` | custom | 5s / 15s |

Web Vital budgets are [Google's Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds).
Custom budgets live in `CUSTOM_METRIC_THRESHOLDS` in
`app/lib/performanceMonitoring.ts` — add new ones there so samples get rated
rather than defaulting to `good`.

## How it is wired

- `components/PerformanceMonitor.tsx` subscribes to Next.js's
  `useReportWebVitals` and is rendered once from the root layout. Web Vitals
  come from Next itself, so there is no extra dependency.
- `app/lib/performanceMonitoring.ts` rates each sample and fans it out.
- Custom timings use `measure()` for a single callback, or `startMeasure()`
  for work spanning several interactions. `dashboardStore.fetchDashboard`
  and the chunked uploader are instrumented this way.

## Where it lands

Every sample goes to two sinks:

1. **Sentry** — as a measurement (`Sentry.setMeasurement`) plus a breadcrumb.
   Samples rated `poor` additionally raise
   `Performance budget exceeded: <metric>` at `warning` level, tagged with
   `metric` and `rating`.
2. **Product analytics** — as a `performance_metric` event through
   `app/lib/analytics.ts`, so performance sits in the same funnels as the
   rest of the product telemetry and respects the same cookie consent.

Each sink is wrapped so a failing transport logs and is skipped — telemetry
never breaks a render, and one broken sink does not stop the others.

## Dashboards and alerting

The code emits everything these need, but both are configured in the Sentry
org rather than in this repo:

- **Dashboard** — build a Sentry dashboard over the `performance_metric`
  measurements, split by the `metric` tag. The `rating` tag gives a
  good/needs-improvement/poor breakdown without any threshold logic in the
  query.
- **Alerting** — create a Sentry issue alert on the message
  `Performance budget exceeded: *`. Because a breach is a distinct captured
  message rather than a dashboard query, alerting needs no metric-alert quota
  and fires on the first bad sample in a release.

Someone with Sentry org admin needs to create both; nothing further is needed
on the application side.
