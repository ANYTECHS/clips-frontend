import { DEFAULT_API_URL, HEALTH_CHECK_TIMEOUT_MS } from "@/lib/constants";
import { success } from "../../apiResponse";

// Deep health check endpoint (issue #1396).
//
// Checks that the app (this Next.js server) is up and that the backend it
// proxies to is healthy. Each dependency check is bounded by a 2-second
// timeout. The response returns a structured status per dependency, e.g.:
//
//   { "status": "healthy",
//     "checks": {
//       "app":     { "ok": true,  "latencyMs": 0 },
//       "backend": { "ok": true,  "latencyMs": 42 } } }
//
// The frontend proxies all data access to the backend, so backend health is
// the frontier for DB/Redis/S3-style degradations (the backend fronts them).

interface DependencyStatus {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

async function checkDependency(
  check: () => Promise<void>
): Promise<DependencyStatus> {
  const startedAt = Date.now();
  try {
    await check();
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  const baseUrl = (process.env.API_URL || DEFAULT_API_URL).replace(
    /\/+$/,
    ""
  );

  const checks = await Promise.all([
    checkDependency(async () => {
      // The app is up while this handler is responding.
    }),
    checkDependency(async () => {
      const res = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`backend returned HTTP ${res.status}`);
    }),
  ]);

  const status =
    checks.every((c) => c.ok) ? "healthy" : "degraded";

  return success(
    {
      status,
      checks: { app: checks[0], backend: checks[1] },
    },
    status === "healthy" ? 200 : 503
  );
}
