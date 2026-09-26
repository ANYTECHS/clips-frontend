/**
 * healthCheck.ts — Issue #898
 *
 * Health check logic shared between /api/health (liveness) and
 * /api/health/ready (readiness).
 *
 * Liveness: lightweight — confirms the process is alive and the app can serve.
 * Readiness: full — probes each external dependency (Redis, AI backend, S3).
 *
 * Dependency probe design:
 *  - Each probe is independent and runs concurrently.
 *  - A probe that throws / times out is treated as "down", never crashes the route.
 *  - Latency is measured per dependency.
 *  - Overall status is "ok" when all deps are ok; "degraded" when some are
 *    reachable but slow/erroring; "down" when a critical dep is unreachable.
 */

export type DependencyStatus = "ok" | "degraded" | "down";

export interface DependencyResult {
  status: DependencyStatus;
  latencyMs: number;
  message?: string;
}

export interface HealthCheckResult {
  status: DependencyStatus;
  version: string;
  timestamp: string;
  uptime: number;
  dependencies?: Record<string, DependencyResult>;
}

const APP_VERSION = process.env.npm_package_version ?? "0.1.0";

// ─── Individual probes ────────────────────────────────────────────────────────

async function probeRedis(): Promise<DependencyResult> {
  const start = Date.now();

  if (!process.env.REDIS_URL) {
    return {
      status: "degraded",
      latencyMs: 0,
      message: "REDIS_URL not set — using in-memory fallback",
    };
  }

  try {
    // Dynamically import to avoid initialising Redis on every request in dev
    const Redis = (await import("ioredis")).default;
    const client = new Redis(process.env.REDIS_URL, {
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    await client.connect();
    const pong = await client.ping();
    await client.quit();

    const latencyMs = Date.now() - start;
    return {
      status: pong === "PONG" ? "ok" : "degraded",
      latencyMs,
    };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Redis connection failed",
    };
  }
}

async function probeAiBackend(): Promise<DependencyResult> {
  const start = Date.now();
  const baseUrl = process.env.NEXT_PUBLIC_AI_API_URL;

  if (!baseUrl) {
    return {
      status: "degraded",
      latencyMs: 0,
      message: "NEXT_PUBLIC_AI_API_URL not set — AI dispatch disabled",
    };
  }

  try {
    const url = `${baseUrl.replace(/\/$/, "")}/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.AI_BACKEND_SECRET ?? ""}`,
      },
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;
    return {
      status: res.ok ? "ok" : "degraded",
      latencyMs,
      message: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "AI backend unreachable",
    };
  }
}

async function probeStorage(): Promise<DependencyResult> {
  const start = Date.now();

  if (!process.env.CLOUD_STORAGE_BUCKET) {
    return {
      status: "degraded",
      latencyMs: 0,
      message: "CLOUD_STORAGE_BUCKET not set — uploads disabled",
    };
  }

  try {
    const { S3Client, HeadBucketCommand } = await import("@aws-sdk/client-s3");

    const s3 = new S3Client({
      region: process.env.CLOUD_STORAGE_REGION ?? "us-east-1",
      ...(process.env.CLOUD_STORAGE_ENDPOINT
        ? { endpoint: process.env.CLOUD_STORAGE_ENDPOINT }
        : {}),
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    });

    await s3.send(
      new HeadBucketCommand({ Bucket: process.env.CLOUD_STORAGE_BUCKET })
    );

    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "S3 unreachable",
    };
  }
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────

function aggregate(
  results: Record<string, DependencyResult>
): DependencyStatus {
  const statuses = Object.values(results).map((r) => r.status);
  if (statuses.every((s) => s === "ok")) return "ok";
  if (statuses.some((s) => s === "down")) return "down";
  return "degraded";
}

// ─── Public check functions ───────────────────────────────────────────────────

/** Lightweight liveness check — no external probes. */
export function livenessCheck(): HealthCheckResult {
  return {
    status: "ok",
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  };
}

/** Full readiness check — probes all external dependencies concurrently. */
export async function readinessCheck(): Promise<HealthCheckResult> {
  const [redis, aiBackend, storage] = await Promise.all([
    probeRedis(),
    probeAiBackend(),
    probeStorage(),
  ]);

  const dependencies: Record<string, DependencyResult> = {
    redis,
    aiBackend,
    storage,
  };

  const status = aggregate(dependencies);

  return {
    status,
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    dependencies,
  };
}
