/**
 * Chunked upload session lifecycle (#881).
 *
 * `POST` opens a session for a file; `GET` reports which chunks have already
 * arrived, which is the whole resume mechanism — a client that lost its
 * connection, or reloaded the page mid-upload, asks what the server already
 * has and sends only the gaps.
 *
 * There is no separate session store: the staged chunk objects in the bucket
 * *are* the session, so progress survives a server restart.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { listUploadChunks } from "@/app/lib/cloudStorage";
import { validateUploadMetadata } from "@/app/api/upload/shared/processUpload";
import { logger } from "@/app/lib/logger";
import {
  CHUNK_SIZE_BYTES,
  fail,
  guardChunkRequest,
  isValidSessionId,
  scopeSession,
} from "../shared";

/** Open a session for a file that is about to be uploaded in chunks. */
export async function POST(request: NextRequest) {
  const guard = await guardChunkRequest(request, { limit: 20 });
  if ("response" in guard) return guard.response;

  let body: { name?: string; size?: number; type?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400, "INVALID_BODY");
  }

  const { name, size, type } = body;
  if (typeof name !== "string" || name.length === 0) {
    return fail("A file name is required", 400, "VALIDATION_FAILED");
  }

  // Validated up front so an oversized or unsupported file is refused before
  // the client spends bandwidth on the first chunk.
  const validationError = validateUploadMetadata({
    name,
    size: Number(size),
    type,
  });
  if (validationError) {
    return fail(validationError, 400, "VALIDATION_FAILED");
  }

  const sessionId = randomUUID();
  const totalChunks = Math.ceil(Number(size) / CHUNK_SIZE_BYTES);

  logger.info(
    `[Upload] Chunked session ${sessionId} opened for ${name} (${totalChunks} chunks)`,
  );

  return NextResponse.json({
    data: {
      sessionId,
      chunkSize: CHUNK_SIZE_BYTES,
      totalChunks,
      receivedChunks: [] as number[],
    },
    error: null,
  });
}

/** Report which chunks of an existing session have already been stored. */
export async function GET(request: NextRequest) {
  const guard = await guardChunkRequest(request, { limit: 60 });
  if ("response" in guard) return guard.response;

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!isValidSessionId(sessionId)) {
    return fail("A valid sessionId is required", 400, "INVALID_SESSION");
  }

  const receivedChunks = await listUploadChunks(
    scopeSession(guard.userId, sessionId),
  );

  return NextResponse.json({
    data: { sessionId, chunkSize: CHUNK_SIZE_BYTES, receivedChunks },
    error: null,
  });
}
