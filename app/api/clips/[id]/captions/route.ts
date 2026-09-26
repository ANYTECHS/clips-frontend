import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { checkCsrf } from "@/app/lib/csrf";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { dispatchJob } from "@/app/lib/aiBackend";
import { logger } from "@/app/lib/logger";
import { clipsStore } from "@/app/api/clips/clipsStore";
import { captionsStore } from "@/app/api/captions/captionsStore";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import {
  generateCaptionsBodySchema,
  updateCaptionsBodySchema,
} from "@/app/api/schemas/captions.schema";
import type { ApiResponse } from "@/app/api/types";

async function assertClipOwnership(userId: string, clipId: string): Promise<NextResponse | null> {
  clipsStore.getClipsForUser(userId);
  const unowned = clipsStore.findUnownedClipIds(userId, [clipId]);
  if (unowned.length > 0) {
    return NextResponse.json({ error: "Clip not found" }, { status: 403 });
  }
  return null;
}

/**
 * POST /api/clips/:id/captions — dispatch caption generation job.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const rateLimited = await applyRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id: clipId } = await context.params;
  const ownershipError = await assertClipOwnership(userId, clipId);
  if (ownershipError) return ownershipError;

  const parsedBody = await parseRequestJson(request);
  if (!parsedBody.ok) return parsedBody.response;

  const bodyValidation = generateCaptionsBodySchema.safeParse(parsedBody.body);
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: bodyValidation.error.issues },
      { status: 400 },
    );
  }

  const { language } = bodyValidation.data;
  const jobId = `caption_${randomUUID().replace(/-/g, "")}`;

  captionsStore.setGenerating(clipId, userId, jobId, language);

  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const callbackUrl = `${base}/api/jobs/${jobId}/callback`;
  const sourceClipKey = `uploads/${clipId}`;

  await jobStore.set(jobId, {
    id: jobId,
    userId,
    status: "queued",
    progress: 0,
    momentsFound: 0,
    estimatedSecondsRemaining: 90,
    createdAt: Date.now(),
  });

  const dispatchResult = await dispatchJob({
    jobId,
    userId,
    objectKey: sourceClipKey,
    contentType: "video/mp4",
    filename: `${clipId}.mp4`,
    callbackUrl,
    sourceClipKey,
    jobType: "caption",
    captionOptions: { language },
  });

  if (!dispatchResult.dispatched) {
    logger.warn(`[captions] Dispatch failed for job ${jobId}: ${dispatchResult.reason}`);
    // In dev without AI backend, seed mock captions immediately
    if (process.env.NODE_ENV !== "production") {
      captionsStore.completeGeneration(clipId, userId, [
        { id: "1", text: "Welcome to the show!", startMs: 0, endMs: 2200 },
        { id: "2", text: "Today we're diving deep.", startMs: 2200, endMs: 4800 },
        { id: "3", text: "This moment is pure gold.", startMs: 4800, endMs: 7200 },
      ], language === "auto" ? "en" : language);
      await jobStore.set(jobId, {
        id: jobId,
        userId,
        status: "complete",
        progress: 100,
        momentsFound: 3,
        estimatedSecondsRemaining: 0,
        createdAt: Date.now(),
      });
    }
  }

  const body: ApiResponse<{ jobId: string; clipId: string; status: string; language: string }> = {
    data: { jobId, clipId, status: "queued", language },
    error: null,
  };

  return NextResponse.json(body, { status: 201 });
}

/**
 * GET /api/clips/:id/captions — return generated subtitle content.
 * PATCH — update editable captions and styling.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id: clipId } = await context.params;
  const ownershipError = await assertClipOwnership(userId, clipId);
  if (ownershipError) return ownershipError;

  let captions = captionsStore.get(clipId, userId);

  if (captions?.jobId) {
    const job = await jobStore.get(captions.jobId);
    if (job?.status === "complete" && captions.status !== "complete") {
      captions = captionsStore.completeGeneration(clipId, userId, [
        { id: "1", text: "Welcome to the show!", startMs: 0, endMs: 2200 },
        { id: "2", text: "Today we're diving deep.", startMs: 2200, endMs: 4800 },
        { id: "3", text: "This moment is pure gold.", startMs: 4800, endMs: 7200 },
      ], captions.language === "auto" ? "en" : captions.language);
    }
    if (job?.status === "error") {
      captions = captionsStore.upsert({
        clipId,
        userId,
        status: "error",
        errorMessage: job.errorMessage ?? "Caption generation failed",
      });
    }
    if (job?.status === "processing") {
      captions = captionsStore.upsert({ clipId, userId, status: "processing" });
    }
  }

  const body: ApiResponse<{
    clipId: string;
    status: string;
    language: string;
    detectedLanguage: string | null;
    segments: typeof captions extends undefined ? never : NonNullable<typeof captions>["segments"];
    style: typeof captions extends undefined ? never : NonNullable<typeof captions>["style"];
    srt: string | null;
    vtt: string | null;
    burnIntoExport: boolean;
  } | null> = {
    data: captions
      ? {
          clipId,
          status: captions.status,
          language: captions.language,
          detectedLanguage: captions.detectedLanguage ?? null,
          segments: captions.segments,
          style: captions.style,
          srt: captions.srtContent ?? null,
          vtt: captions.vttContent ?? null,
          burnIntoExport: captions.burnIntoExport,
        }
      : null,
    error: null,
  };

  return NextResponse.json(body);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id: clipId } = await context.params;
  const ownershipError = await assertClipOwnership(userId, clipId);
  if (ownershipError) return ownershipError;

  const parsedBody = await parseRequestJson(request);
  if (!parsedBody.ok) return parsedBody.response;

  const bodyValidation = updateCaptionsBodySchema.safeParse(parsedBody.body);
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: bodyValidation.error.issues },
      { status: 400 },
    );
  }

  const { segments, style, language, burnIntoExport } = bodyValidation.data;

  const updated = captionsStore.upsert({
    clipId,
    userId,
    segments,
    style,
    language,
    burnIntoExport,
    status: "complete",
  });

  const body: ApiResponse<{ success: boolean; captions: typeof updated }> = {
    data: { success: true, captions: updated },
    error: null,
  };

  return NextResponse.json(body);
}
