/**
 * Stage one chunk of an in-progress upload (#881).
 *
 * The body is the raw chunk bytes; the session and index travel as query
 * parameters. Writing the same index twice is deliberately idempotent, so a
 * client that retries a chunk whose response it never saw is not an error.
 */

import { NextRequest, NextResponse } from "next/server";
import { putUploadChunk } from "@/app/lib/cloudStorage";
import { logger } from "@/app/lib/logger";
import {
  CHUNK_SIZE_BYTES,
  fail,
  guardChunkRequest,
  isValidSessionId,
  scopeSession,
} from "./shared";

/** Highest chunk index a 500MB file can reach, as a sanity bound. */
const MAX_CHUNK_INDEX = 10_000;

export async function PUT(request: NextRequest) {
  const guard = await guardChunkRequest(request, { limit: 300 });
  if ("response" in guard) return guard.response;

  const params = request.nextUrl.searchParams;
  const sessionId = params.get("sessionId");
  const index = Number(params.get("index"));

  if (!isValidSessionId(sessionId)) {
    return fail("A valid sessionId is required", 400, "INVALID_SESSION");
  }
  if (!Number.isInteger(index) || index < 0 || index > MAX_CHUNK_INDEX) {
    return fail("A valid chunk index is required", 400, "INVALID_CHUNK_INDEX");
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.length === 0) {
    return fail("Chunk body is empty", 400, "EMPTY_CHUNK");
  }
  if (body.length > CHUNK_SIZE_BYTES) {
    return fail(
      `Chunk exceeds the maximum size of ${CHUNK_SIZE_BYTES} bytes`,
      413,
      "CHUNK_TOO_LARGE",
    );
  }

  try {
    await putUploadChunk(scopeSession(guard.userId, sessionId), index, body);
  } catch (error) {
    logger.error(`[Upload] Failed to store chunk ${index}:`, error);
    return fail("Failed to store chunk", 500, "CHUNK_STORE_FAILED");
  }

  return NextResponse.json({
    data: { sessionId, index, size: body.length },
    error: null,
  });
}
