/**
 * GET /api/health/ready — Issue #898
 *
 * Readiness probe. Checks all external dependencies (Redis, AI backend, S3)
 * concurrently and returns a structured report.
 *
 * HTTP status codes:
 *   200 — all dependencies healthy or degraded (service can handle traffic)
 *   503 — one or more critical dependencies are down
 *
 * No authentication required; safe for load balancers and uptime monitors.
 * Rate-limited to 60 req/min per IP to prevent probe abuse.
 *
 * Response shape:
 * {
 *   "data": {
 *     "status": "ok" | "degraded" | "down",
 *     "version": "0.1.0",
 *     "timestamp": "...",
 *     "uptime": 3600,
 *     "dependencies": {
 *       "redis":     { "status": "ok",       "latencyMs": 2 },
 *       "aiBackend": { "status": "degraded", "latencyMs": 4500, "message": "..." },
 *       "storage":   { "status": "ok",       "latencyMs": 12 }
 *     }
 *   },
 *   "error": null
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { readinessCheck } from "../healthCheck";
import { ok } from "@/app/api/types";
import { applyRateLimit } from "@/app/lib/serverRateLimit";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rateLimited = await applyRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const result = await readinessCheck();
  const httpStatus = result.status === "down" ? 503 : 200;

  return NextResponse.json(ok(result), {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
