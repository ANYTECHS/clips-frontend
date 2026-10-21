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

Every sample goes to three sinks:

1. **Sentry** — as a measurement (`Sentry.setMeasurement`) plus a breadcrumb.
   Samples rated `poor` additionally raise
   `Performance budget exceeded: <metric>` at `warning` level, tagged with
   `metric` and `rating`.
2. **Product analytics** — as a `performance_metric` event through
   `app/lib/analytics.ts`, so performance sits in the same funnels as the
   rest of the product telemetry and respects the same cookie consent.
3. **First-party RUM collector** — batched and sent with
   `navigator.sendBeacon` to `POST /api/rum` when the page is hidden or 20
   samples are queued (#1181). See below.

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

## Real User Monitoring dashboard and alerts (#1181)

`/api/rum` (`app/api/rum/route.ts`, aggregation in `app/lib/rumAggregator.ts`)
keeps a rolling window of the last 500 real-user samples per metric.

- **Dashboard feed** — `GET /api/rum` (bearer `METRICS_TOKEN`, same as
  `/api/metrics`) returns, per metric, `count`, `p75`, the p75 `rating`,
  `poorRatio` and `alert`. Point a Grafana JSON datasource or status page at
  it for a live Core Web Vitals view.
- **Alerts** — a metric is in alert when it has at least 20 samples and more
  than 25% of them are rated `poor` (`RUM_ALERT_MIN_SAMPLES`,
  `RUM_ALERT_POOR_RATIO`). Alerting metrics are listed in the response's
  `alerts` array and logged as `[rum] alert: ...` warnings on ingest, so a
  log-based alert can page on them.
- **Budgets / targets** — ratings use the same thresholds as the table at
  the top of this file; the p75 of each Core Web Vital should stay `good`.
  Full budgets are in `docs/PERFORMANCE_BUDGETS.md`.

The window is per server instance and resets on deploy; long-term history
lives in Sentry and analytics.
