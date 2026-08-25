/**
 * POST /api/jobs/[id]/callback
 *
 * Webhook endpoint called by the AI backend to report job progress and
 * terminal state. This is the sole writer of job status into the job store.
 *
 * Authentication: Bearer token from AI_BACKEND_CALLBACK_SECRET.
 *   - Required in production (returns 401 when missing/wrong).
 *   - In development (no secret configured) requests are accepted with a
 *     console warning so the backend can be tested locally without credentials.
 *
 * Replay protection (required on every request, regardless of the above):
 *   - X-Timestamp: Unix timestamp (seconds) the request was sent. Rejected
 *     with 401 if more than 60 seconds away from the server's clock.
 *   - X-Nonce: a UUID unique to this request. Rejected with 401 if it has
 *     already been used within the last 2 minutes (cached in Redis/memory).
 *
 * Request body (all fields except jobId optional for partial updates):
 * {
 *   "status":                    "queued" | "processing" | "complete" | "error",
 *   "progress":                  0–100,
 *   "momentsFound":              number,
 *   "estimatedSecondsRemaining": number,
 *   "errorCode":                 AiErrorCode,   // only on status=error
 *   "errorMessage":              string         // only on status=error
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { jobStore, type JobStatus, type AiErrorCode } from "../../shared/jobStore";
import { parseJsonRequest } from "../../shared/jsonBody";
import { consumeNonce } from "../../shared/nonceCache";
import { z } from "zod";
import { logger } from "@/app/lib/logger";

const TIMESTAMP_TOLERANCE_SECONDS = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Validation schema ────────────────────────────────────────────────────────

const AI_ERROR_CODES: [AiErrorCode, ...AiErrorCode[]] = [
  "UNSUPPORTED_CODEC",
  "VIDEO_TOO_SHORT",
  "VIDEO_TOO_LONG",
  "PROCESSING_TIMEOUT",
  "INTERNAL_ERROR",
];

const ScoreBreakdownSchema = z.object({
  hook: z.number().min(0).max(100),
  retention: z.number().min(0).max(100),
  emotional: z.number().min(0).max(100),
  trending: z.number().min(0).max(100),
});

const CallbackBodySchema = z.object({
  status: z.enum(["queued", "processing", "complete", "error"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  momentsFound: z.number().min(0).optional(),
  estimatedSecondsRemaining: z.number().min(0).optional(),
  scoreBreakdown: ScoreBreakdownSchema.optional(),
  errorCode: z.enum(AI_ERROR_CODES).optional(),
  errorMessage: z.string().max(500).optional(),
});

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const authError = validateCallbackSecret(request);
  if (authError) return authError;

  // ── Replay protection ──────────────────────────────────────────────────────
  const replayError = await validateReplayProtection(request);
  if (replayError) return replayError;

  // ── Params / store lookup ──────────────────────────────────────────────────
  const { id: jobId } = await context.params;
  const job = await jobStore.get(jobId);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ── Body parsing ───────────────────────────────────────────────────────────
  const parsedBody = await parseJsonRequest<unknown>(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = CallbackBodySchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const update = parsed.data;

  // ── Guard: ignore updates after terminal state ─────────────────────────────
  if (job.status === "complete" || job.status === "error") {
    return NextResponse.json(
      { warning: "Job already in terminal state; update ignored" },
      { status: 200 }
    );
  }

  // ── Validate error state consistency ──────────────────────────────────────
  if (update.status === "error" && !update.errorCode) {
    return NextResponse.json(
      { error: "errorCode is required when status is 'error'" },
      { status: 422 }
    );
  }

  // ── Apply the update ───────────────────────────────────────────────────────
  await jobStore.set(jobId, {
    ...job,
    status: (update.status ?? job.status) as JobStatus,
    progress: update.progress ?? job.progress,
    momentsFound: update.momentsFound ?? job.momentsFound,
    estimatedSecondsRemaining:
      update.estimatedSecondsRemaining ?? job.estimatedSecondsRemaining,
    ...(update.scoreBreakdown ? { scoreBreakdown: update.scoreBreakdown } : {}),
    ...(update.errorCode ? { errorCode: update.errorCode } : {}),
    ...(update.errorMessage ? { errorMessage: update.errorMessage } : {}),
  });

  return NextResponse.json({ success: true });
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function validateCallbackSecret(request: NextRequest): NextResponse | null {
  const expectedSecret = process.env.AI_BACKEND_CALLBACK_SECRET;

  if (!expectedSecret) {
    if (process.env.NODE_ENV === "production") {
      // Misconfigured production deployment — reject all callbacks.
      logger.error(
        "[jobs/callback] AI_BACKEND_CALLBACK_SECRET is not set in production. " +
          "All callback requests will be rejected."
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Dev without a secret — accept but warn.
    logger.warn(
      "[jobs/callback] AI_BACKEND_CALLBACK_SECRET is not set; " +
        "accepting unauthenticated callback. Set this in production."
    );
    return null;
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (token !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

async function validateReplayProtection(
  request: NextRequest
): Promise<NextResponse | null> {
  const timestampHeader = request.headers.get("x-timestamp");
  const nonce = request.headers.get("x-nonce");

  if (!timestampHeader || !nonce) {
    return NextResponse.json(
      { error: "Missing X-Timestamp or X-Nonce header" },
      { status: 401 }
    );
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) {
    return NextResponse.json(
      { error: "Invalid X-Timestamp header" },
      { status: 401 }
    );
  }

  const nowSeconds = Date.now() / 1000;
  if (Math.abs(nowSeconds - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
    return NextResponse.json(
      { error: "Request timestamp is outside the allowed window" },
      { status: 401 }
    );
  }

  if (!UUID_RE.test(nonce)) {
    return NextResponse.json({ error: "Invalid X-Nonce header" }, { status: 401 });
  }

  const isNewNonce = await consumeNonce(nonce);
  if (!isNewNonce) {
    return NextResponse.json({ error: "Duplicate nonce" }, { status: 401 });
  }

  return null;
}
