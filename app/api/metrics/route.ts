/**
 * GET /api/metrics
 *
 * Exposes application metrics in both Prometheus text exposition format and
 * JSON, intended for:
 *   - Prometheus / Grafana scrape targets
 *   - External auto-scalers (Kubernetes KEDA, AWS Application Auto Scaling)
 *   - Fly.io / Render scaling webhooks
 *   - Synthetic health dashboards
 *
 * Format negotiation:
 *   Accept: application/json               → JSON body
 *   Accept: text/plain | *\/* (default)    → Prometheus text format
 *
 * Security:
 *   Protected by a static bearer token (METRICS_TOKEN env var).
 *   In development with no token set, requests are accepted with a warning.
 *   Rate-limited to 120 req/min per IP.
 *
 * Metrics exposed:
 *   clipcash_jobs_total{status}         — cumulative job counts by status
 *   clipcash_jobs_queued                — jobs currently waiting to be dispatched
 *   clipcash_jobs_active                — jobs currently processing
 *   clipcash_jobs_failed                — jobs in error terminal state
 *   clipcash_jobs_complete              — jobs in complete terminal state
 *   clipcash_process_uptime_seconds     — process uptime
 *   clipcash_process_memory_rss_bytes   — RSS memory usage
 *   clipcash_process_memory_heap_bytes  — V8 heap used
 *   clipcash_circuit_breaker_state{service} — 0=CLOSED, 1=HALF_OPEN, 2=OPEN
 *   clipcash_circuit_breaker_failures{service} — consecutive failure counter
 *   clipcash_circuit_breaker_total_calls{service}
 *   clipcash_circuit_breaker_total_fallbacks{service}
 */

import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { allCircuitBreakerSnapshots } from "@/app/lib/circuitBreaker";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { logger } from "@/app/lib/logger";
import { fetchAnalytics } from "@/app/lib/cache/FetchAnalytics";

// ─── Auth ────────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const token = process.env.METRICS_TOKEN;

  if (!token) {
    if (process.env.NODE_ENV === "production") {
      // No token configured in production — deny all to avoid data leakage.
      logger.warn("[metrics] METRICS_TOKEN is not set in production; denying request");
      return false;
    }
    // Dev: accept without a token but log a reminder.
    logger.warn("[metrics] METRICS_TOKEN not set — accepting unauthenticated metrics request (dev only)");
    return true;
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  return provided === token;
}

// ─── Circuit breaker state encoding ──────────────────────────────────────────

function cbStateValue(state: string): number {
  if (state === "OPEN") return 2;
  if (state === "HALF_OPEN") return 1;
  return 0; // CLOSED
}

// ─── Prometheus text format helpers ──────────────────────────────────────────

function promLine(
  name: string,
  labels: Record<string, string>,
  value: number,
): string {
  const labelStr = Object.entries(labels)
    .map(([k, v]) => `${k}="${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`)
    .join(",");
  return labelStr ? `${name}{${labelStr}} ${value}` : `${name} ${value}`;
}

function promMetric(
  name: string,
  help: string,
  type: "gauge" | "counter",
  lines: string[],
): string {
  return [`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`, ...lines].join("\n");
}

// ─── Data collection ──────────────────────────────────────────────────────────

async function collectMetrics() {
  const [jobs, breakers] = await Promise.all([
    jobStore.getAll().catch(() => []),
    Promise.resolve(allCircuitBreakerSnapshots()),
  ]);

  const queued   = jobs.filter((j) => j.status === "queued").length;
  const active   = jobs.filter((j) => j.status === "processing").length;
  const complete = jobs.filter((j) => j.status === "complete").length;
  const failed   = jobs.filter((j) => j.status === "error").length;

  const mem     = process.memoryUsage();
  const uptime  = Math.floor(process.uptime());

  return { queued, active, complete, failed, mem, uptime, breakers };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Rate-limit first (cheap, no DB calls).
  const limited = await applyRateLimit(request, { limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="metrics"' } },
    );
  }

  const { queued, active, complete, failed, mem, uptime, breakers } =
    await collectMetrics();
  const fetches = fetchAnalytics.snapshot();

  const wantsJson =
    (request.headers.get("accept") ?? "").toLowerCase().includes("application/json");

  if (wantsJson) {
    return NextResponse.json(
      {
        jobs: { queued, active, complete, failed, total: queued + active + complete + failed },
        process: {
          uptimeSeconds: uptime,
          memoryRssBytes: mem.rss,
          memoryHeapUsedBytes: mem.heapUsed,
          memoryHeapTotalBytes: mem.heapTotal,
        },
        circuitBreakers: breakers.map((b) => ({
          name: b.name,
          state: b.state,
          failures: b.failures,
          totalCalls: b.totalCalls,
          totalFailures: b.totalFailures,
          totalFallbacks: b.totalFallbacks,
          openedAt: b.openedAt,
          lastFailureAt: b.lastFailureAt,
        })),
        fetches,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── Prometheus text format ──────────────────────────────────────────────────
  const blocks: string[] = [
    promMetric("clipcash_jobs_queued", "Jobs waiting to be dispatched to the AI backend", "gauge",
      [promLine("clipcash_jobs_queued", {}, queued)]),

    promMetric("clipcash_jobs_active", "Jobs currently being processed by the AI backend", "gauge",
      [promLine("clipcash_jobs_active", {}, active)]),

    promMetric("clipcash_jobs_complete", "Jobs that completed successfully (terminal state)", "gauge",
      [promLine("clipcash_jobs_complete", {}, complete)]),

    promMetric("clipcash_jobs_failed", "Jobs in error terminal state", "gauge",
      [promLine("clipcash_jobs_failed", {}, failed)]),

    promMetric("clipcash_jobs_total", "Total job counts by status", "gauge", [
      promLine("clipcash_jobs_total", { status: "queued" },    queued),
      promLine("clipcash_jobs_total", { status: "active" },    active),
      promLine("clipcash_jobs_total", { status: "complete" },  complete),
      promLine("clipcash_jobs_total", { status: "failed" },    failed),
    ]),

    promMetric("clipcash_process_uptime_seconds", "Process uptime in seconds", "gauge",
      [promLine("clipcash_process_uptime_seconds", {}, uptime)]),

    promMetric("clipcash_process_memory_rss_bytes", "Resident set size memory in bytes", "gauge",
      [promLine("clipcash_process_memory_rss_bytes", {}, mem.rss)]),

    promMetric("clipcash_process_memory_heap_bytes", "V8 heap used in bytes", "gauge",
      [promLine("clipcash_process_memory_heap_bytes", {}, mem.heapUsed)]),

    promMetric("clipcash_circuit_breaker_state",
      "Circuit breaker state: 0=CLOSED, 1=HALF_OPEN, 2=OPEN", "gauge",
      breakers.map((b) => promLine("clipcash_circuit_breaker_state", { service: b.name }, cbStateValue(b.state)))),

    promMetric("clipcash_circuit_breaker_failures",
      "Consecutive failure count for each circuit breaker", "gauge",
      breakers.map((b) => promLine("clipcash_circuit_breaker_failures", { service: b.name }, b.failures))),

    promMetric("clipcash_circuit_breaker_total_calls",
      "Total calls attempted through each circuit breaker", "counter",
      breakers.map((b) => promLine("clipcash_circuit_breaker_total_calls", { service: b.name }, b.totalCalls))),

    promMetric("clipcash_circuit_breaker_total_fallbacks",
      "Total fallback invocations for each circuit breaker", "counter",
      breakers.map((b) => promLine("clipcash_circuit_breaker_total_fallbacks", { service: b.name }, b.totalFallbacks))),

    promMetric("clipcash_fetch_total", "Fetch attempts recorded in the bounded process window", "counter",
      [promLine("clipcash_fetch_total", {}, fetches.total)]),
    promMetric("clipcash_fetch_errors_total", "Fetch attempts that failed", "counter",
      [promLine("clipcash_fetch_errors_total", {}, fetches.errors)]),
    promMetric("clipcash_fetch_cache_hits_total", "Fetches served from a fresh cache entry", "counter",
      [promLine("clipcash_fetch_cache_hits_total", {}, fetches.cacheHits)]),
    promMetric("clipcash_fetch_batches_total", "Batch fetch requests recorded", "counter",
      [promLine("clipcash_fetch_batches_total", {}, fetches.batches)]),
    promMetric("clipcash_fetch_batched_items_total", "Items loaded by batch requests", "counter",
      [promLine("clipcash_fetch_batched_items_total", {}, fetches.batchedItems)]),
    promMetric("clipcash_fetch_average_duration_ms", "Average fetch duration in milliseconds", "gauge",
      [promLine("clipcash_fetch_average_duration_ms", {}, fetches.averageDurationMs)]),
    promMetric("clipcash_fetch_p95_duration_ms", "95th percentile fetch duration in milliseconds", "gauge",
      [promLine("clipcash_fetch_p95_duration_ms", {}, fetches.p95DurationMs)]),
  ];

  const body = blocks.join("\n\n") + "\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
