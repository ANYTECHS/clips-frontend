/**
 * GET /api/health/circuit-breakers
 *
 * Internal diagnostic endpoint that exposes the current state of every
 * registered circuit breaker in this worker process.
 *
 * Intended for:
 *  - Operations dashboards and runbooks
 *  - The in-app DegradedModeBanner component (polled client-side)
 *  - Automated alerting pipelines
 *
 * Access control: no authentication required so load-balancer health checks
 * and monitoring agents can reach it without a session token, but it is
 * rate-limited to 120 req/min per IP to prevent probe abuse.
 *
 * Response shape:
 * {
 *   "data": {
 *     "overallDegraded": false,
 *     "breakers": [
 *       {
 *         "name": "aiBackend",
 *         "state": "CLOSED",
 *         "failures": 0,
 *         "successes": 0,
 *         "totalCalls": 42,
 *         "totalFailures": 1,
 *         "totalFallbacks": 1,
 *         "lastFailureAt": 1722000000000,
 *         "lastSuccessAt": 1722001000000,
 *         "openedAt": null
 *       },
 *       ...
 *     ]
 *   },
 *   "error": null
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { allCircuitBreakerSnapshots } from "@/app/lib/circuitBreaker";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { ok } from "@/app/api/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rateLimited = await applyRateLimit(request, {
    limit: 120,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const breakers = allCircuitBreakerSnapshots();
  const overallDegraded = breakers.some((b) => b.state !== "CLOSED");

  return NextResponse.json(
    ok({ overallDegraded, breakers }),
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
