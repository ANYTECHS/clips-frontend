/**
 * GET /api/health — Issue #898
 *
 * Liveness probe. Confirms the process is alive and can serve requests.
 * Does NOT check external dependencies — use /api/health/ready for that.
 *
 * Always returns 200 while the process is alive.
 * No authentication required; safe to expose to load balancers and uptime monitors.
 *
 * Response shape:
 * {
 *   "data": {
 *     "status": "ok",
 *     "version": "0.1.0",
 *     "timestamp": "2026-08-25T15:00:00.000Z",
 *     "uptime": 3600
 *   },
 *   "error": null
 * }
 */

import { NextResponse } from "next/server";
import { livenessCheck } from "./healthCheck";
import { ok } from "@/app/api/types";

export async function GET(): Promise<NextResponse> {
  const result = livenessCheck();

  return NextResponse.json(ok(result), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
