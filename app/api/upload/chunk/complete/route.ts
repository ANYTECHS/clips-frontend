/**
 * Finalise a chunked upload (#881).
 *
 * Assembles the staged chunks into the original file and hands it to the same
 * validation, virus scan and storage pipeline the whole-file route uses, then
 * registers and dispatches the job exactly as that route does. From this point
 * on a chunked upload is indistinguishable from a single-request one.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  assembleUploadChunks,
  discardUploadChunks,
} from "@/app/lib/cloudStorage";
import {
  processUploadedBuffer,
  validateUploadMetadata,
} from "@/app/api/upload/shared/processUpload";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { dispatchJob } from "@/app/lib/aiBackend";
import { logger } from "@/app/lib/logger";
import {
  fail,
  guardChunkRequest,
  isValidSessionId,
  scopeSession,
} from "../shared";

export async function POST(request: NextRequest) {
  const guard = await guardChunkRequest(request, { limit: 20 });
  if ("response" in guard) return guard.response;
  const { userId } = guard;

  let body: {
    sessionId?: string;
    name?: string;
    size?: number;
    type?: string;
    totalChunks?: number;
  };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400, "INVALID_BODY");
  }

  const { sessionId, name, type, totalChunks } = body;
  if (!isValidSessionId(sessionId)) {
    return fail("A valid sessionId is required", 400, "INVALID_SESSION");
  }
  if (typeof name !== "string" || name.length === 0) {
    return fail("A file name is required", 400, "VALIDATION_FAILED");
  }
  if (!Number.isInteger(totalChunks) || (totalChunks as number) <= 0) {
    return fail("A valid totalChunks is required", 400, "VALIDATION_FAILED");
  }

  // Re-validated here rather than trusted from the session: the client controls
  // this body, and the metadata it declared at session creation is not
  // authoritative.
  const validationError = validateUploadMetadata({
    name,
    size: Number(body.size),
    type,
  });
  if (validationError) {
    return fail(validationError, 400, "VALIDATION_FAILED");
  }

  const scopedSession = scopeSession(userId, sessionId);
  const contentType = type || "application/octet-stream";

  try {
    const buffer = await assembleUploadChunks(
      scopedSession,
      totalChunks as number,
    );

    // The assembled length is the only size that matters; the declared one was
    // a hint for early rejection.
    const sizeError = validateUploadMetadata({
      name,
      size: buffer.length,
      type,
    });
    if (sizeError) {
      await discardUploadChunks(scopedSession);
      return fail(sizeError, 400, "VALIDATION_FAILED");
    }

    const result = await processUploadedBuffer(buffer, name, contentType);

    // Only once the file is safely stored — a failure above leaves the chunks
    // in place so the client can retry the completion.
    await discardUploadChunks(scopedSession);

    const callbackBase =
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    jobStore.set(result.jobId, {
      id: result.jobId,
      userId,
      status: "queued",
      progress: 0,
      momentsFound: 0,
      estimatedSecondsRemaining: 0,
      createdAt: Date.now(),
      ...({ objectKey: result.objectKey } as object),
      ...({ contentType: result.type } as object),
      ...({ filename: result.name } as object),
    });

    await dispatchJob({
      jobId: result.jobId,
      userId,
      objectKey: result.objectKey,
      contentType: result.type,
      filename: result.name,
      callbackUrl: `${callbackBase}/api/jobs/${result.jobId}/callback`,
    });

    logger.info(`[Upload] Chunked session ${sessionId} completed as ${result.jobId}`);

    return NextResponse.json({
      data: {
        success: true,
        message: "Successfully uploaded 1 file(s)",
        jobId: result.jobId,
        files: [result],
      },
      error: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // A missing chunk is the client's to fix by re-sending it, so the staged
    // chunks are deliberately left in place.
    if (message.includes("missing chunks")) {
      logger.error(`[Upload] Incomplete chunked session ${sessionId}: ${message}`);
      return fail(
        "Upload is incomplete — some chunks are missing",
        409,
        "INCOMPLETE_UPLOAD",
      );
    }

    // Anything the scan rejected is final: drop the staged bytes.
    if (message.includes("security scan") || message.includes("does not match")) {
      await discardUploadChunks(scopedSession).catch(() => undefined);
      logger.error(`[Upload] Chunked session ${sessionId} rejected: ${message}`);
      return fail("File failed security scan", 400, "SECURITY_SCAN_FAILED");
    }

    if (message.startsWith("Missing required environment variable")) {
      logger.error("Upload config error:", message);
      return fail(
        "Cloud storage is not configured. Contact support.",
        503,
        "STORAGE_NOT_CONFIGURED",
      );
    }

    logger.error(`[Upload] Chunked completion failed for ${sessionId}:`, error);
    return fail(
      "Internal server error during upload",
      500,
      "UPLOAD_INTERNAL_ERROR",
    );
  }
}
