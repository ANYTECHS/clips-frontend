/**
 * /api/rum — Real User Monitoring collector and dashboard feed (#1181).
 *
 * POST  Beacon endpoint for `performanceMonitoring.ts`. Accepts
 *       `{ samples: [{ name, value, path? }] }`, unauthenticated (browsers send
 *       it via `navigator.sendBeacon`) but rate-limited and size-capped.
 * GET   Returns the per-metric p75 / rating / alert summary. Protected by the
 *       same `METRICS_TOKEN` bearer token as `/api/metrics`.
 */

import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { logger } from "@/app/lib/logger";
import { recordRumSamples, summarizeRum, type RumSample } from "@/app/lib/rumAggregator";

const MAX_SAMPLES_PER_BEACON = 50;
const METRIC_NAME_PATTERN = /^[A-Za-z][\w.-]{0,63}$/;

function isAuthorized(request: NextRequest): boolean {
  const token = process.env.METRICS_TOKEN;
  if (!token) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${token}`;
}

function isSample(value: unknown): value is RumSample {
  if (!value || typeof value !== "object") return false;
  const { name, value: v } = value as Record<string, unknown>;
  return (
    typeof name === "string" &&
    METRIC_NAME_PATTERN.test(name) &&
    typeof v === "number" &&
    Number.isFinite(v) &&
    v >= 0
  );
}

export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  let body: unknown;
  try {
    // sendBeacon posts as text/plain, so parse the raw text rather than relying on Content-Type.
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body as { samples?: unknown })?.samples;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "Expected { samples: [] }" }, { status: 400 });
  }

  const samples = raw.slice(0, MAX_SAMPLES_PER_BEACON).filter(isSample);
  recordRumSamples(samples);

  for (const metric of summarizeRum()) {
    if (metric.alert) {
      logger.warn(
        `[rum] alert: ${metric.name} poor ratio ${(metric.poorRatio * 100).toFixed(1)}% (p75 ${Math.round(metric.p75)})`
      );
    }
  }

  return new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, { limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const metrics = summarizeRum();
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    metrics,
    alerts: metrics.filter((m) => m.alert).map((m) => m.name),
  });
}
