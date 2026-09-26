import { NextRequest, NextResponse } from "next/server";
import { checkCsrf } from "@/app/lib/csrf";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { getEndpointRateLimit } from "@/app/lib/endpointRateLimits";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { dispatchJob } from "@/app/lib/aiBackend";
import { logger } from "@/app/lib/logger";
import { randomUUID } from "crypto";
import { transformBodySchema } from "../schemas/index";

// ─── POST /api/transform ──────────────────────────────────────────────────────

/**
 * Create a new AI video transformation job.
 *
 * Request body:
 *   { clipId: string, style: string, userId?: string }
 *
 * Response:
 *   201 { jobId, clipId, style, status: "queued" }
 *
 * The job is dispatched to the AI backend immediately. The backend reports
 * progress via callbacks to /api/jobs/[id]/callback (same flow as clip jobs).
 */
export async function POST(request: NextRequest) {
  // Rate-limit to 20 transform requests per minute per client
  const rateLimited = await applyRateLimit(request, getEndpointRateLimit("/api/transform"));
  if (rateLimited) return rateLimited;

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId: authenticatedUserId } = authResult;

  // Parse body
  const parsedBody = await parseRequestJson(request);
  if (!parsedBody.ok) return parsedBody.response;
  const rawBody = parsedBody.body;

  // Validate request body with Zod
  const bodyValidation = transformBodySchema.safeParse(rawBody);
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: bodyValidation.error.issues },
      { status: 400 }
    );
  }

  const { clipId, style, transformOptions } = bodyValidation.data;
  const userId = authenticatedUserId;

  // Build job id and derive the source clip's storage key
  const jobId = `transform_${randomUUID().replace(/-/g, "")}`;
  // The source clip key follows the same convention used by uploadFile:
  // KEY_PREFIX + clipId + extension. We pass the clipId as sourceClipKey
  // and let the AI backend resolve the full path using its own storage config.
  const sourceClipKey = `uploads/${clipId}`;

  // Derive callback URL from NEXTAUTH_URL (same approach as jobs/[id]/route.ts)
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const callbackUrl = `${base}/api/jobs/${jobId}/callback`;

  const dispatchResult = await dispatchJob({
    jobId,
    userId,
    objectKey: sourceClipKey,
    contentType: "video/mp4",
    filename: `${clipId}.mp4`,
    callbackUrl,
    transformStyle: style,
    sourceClipKey,
    ...(transformOptions ? { transformOptions } : {}),
  });

  if (!dispatchResult.dispatched) {
    logger.warn(
      `[transform] Dispatch failed for job ${jobId}: ${dispatchResult.reason}. ` +
        "Job will remain in queued status.",
    );
  }

  return NextResponse.json(
    {
      jobId,
      clipId,
      style,
      status: "queued",
      dispatched: dispatchResult.dispatched,
    },
    { status: 201 },
  );
}
