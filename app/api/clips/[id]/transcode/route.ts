import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { checkCsrf } from "@/app/lib/csrf";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { parseRequestJson } from "@/app/lib/parseRequestJson";
import { dispatchJob } from "@/app/lib/aiBackend";
import { logger } from "@/app/lib/logger";
import { isExportQualityAllowed } from "@/app/lib/planLimits";
import { buildExportObjectKey } from "@/app/lib/cloudStorage";
import { prisma } from "@/app/lib/prisma";
import { clipsStore } from "@/app/api/clips/clipsStore";
import { exportsStore } from "@/app/api/exports/exportsStore";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { transcodeBodySchema } from "@/app/api/schemas/index";
import type { ApiResponse } from "@/app/api/types";

/**
 * POST /api/clips/:id/transcode
 *
 * Dispatch an asynchronous transcoding job for the clip.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const rateLimited = await applyRateLimit(request, { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id: clipId } = await context.params;

  clipsStore.getClipsForUser(userId);
  const unowned = clipsStore.findUnownedClipIds(userId, [clipId]);
  if (unowned.length > 0) {
    return NextResponse.json({ error: "Clip not found" }, { status: 403 });
  }

  const parsedBody = await parseRequestJson(request);
  if (!parsedBody.ok) return parsedBody.response;

  const bodyValidation = transcodeBodySchema.safeParse(parsedBody.body);
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: bodyValidation.error.issues },
      { status: 400 },
    );
  }

  const { format, aspectRatio, quality } = bodyValidation.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const plan = user?.plan ?? "free";

  if (!isExportQualityAllowed(plan, quality)) {
    return NextResponse.json(
      {
        error: "Plan restriction",
        message: "Free plan supports 720p exports only. Upgrade to Pro for 1080p.",
      },
      { status: 403 },
    );
  }

  const jobId = `transcode_${randomUUID().replace(/-/g, "")}`;
  const exportRecord = exportsStore.createExport({
    clipId,
    userId,
    jobId,
    format,
    aspectRatio,
    quality,
    objectKey: "",
  });

  const objectKey = buildExportObjectKey(clipId, format, aspectRatio, quality, exportRecord.id);
  exportsStore.updateById(exportRecord.id, { objectKey });

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
    estimatedSecondsRemaining: 120,
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
    jobType: "transcode",
    transcodeOptions: {
      format,
      aspectRatio,
      quality,
      outputObjectKey: objectKey,
    },
  });

  if (!dispatchResult.dispatched) {
    logger.warn(
      `[transcode] Dispatch failed for job ${jobId}: ${dispatchResult.reason}`,
    );
  }

  const body: ApiResponse<{
    exportId: string;
    jobId: string;
    clipId: string;
    format: string;
    aspectRatio: string;
    quality: string;
    status: string;
    dispatched: boolean;
  }> = {
    data: {
      exportId: exportRecord.id,
      jobId,
      clipId,
      format,
      aspectRatio,
      quality,
      status: "queued",
      dispatched: dispatchResult.dispatched,
    },
    error: null,
  };

  return NextResponse.json(body, { status: 201 });
}
