/**
 * Shared plumbing for the chunked upload routes (#881).
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth } from "@/app/lib/auth";
import { checkCsrf } from "@/app/lib/csrf";
import { applyRateLimit } from "@/app/lib/serverRateLimit";

/** Size of one chunk, in bytes. */
export const CHUNK_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Files at or above this size are uploaded in chunks.
 *
 * Below it the single-request path is cheaper: chunking costs a round trip per
 * chunk plus an assembly pass, which is not worth it for a file that would
 * have finished in one request anyway.
 */
export const CHUNKED_UPLOAD_THRESHOLD_BYTES = 10 * 1024 * 1024;

/** Standard envelope used by the upload routes. */
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  code?: string;
}

/** Reject a request with the shared envelope. */
export function fail(
  error: string,
  status: number,
  code?: string,
): NextResponse {
  return NextResponse.json({ data: null, error, code } as ApiResponse<never>, {
    status,
  });
}

/**
 * Namespace a session under the authenticated user.
 *
 * The scope is derived from the session on the server, never from the request
 * body, so one user's session id can never address another user's staged
 * chunks even if it leaks.
 */
export function scopeSession(userId: string, sessionId: string): string {
  const scope = createHash("sha256").update(userId).digest("hex").slice(0, 16);
  return `${scope}/${sessionId}`;
}

/** A session id as minted by this API: a bare UUID. */
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Validate a client-supplied session id.
 *
 * The id becomes part of an object key, so anything but the exact UUID shape
 * is refused — that also rules out traversal via `..` or a stray slash.
 */
export function isValidSessionId(sessionId: unknown): sessionId is string {
  return typeof sessionId === "string" && SESSION_ID_PATTERN.test(sessionId);
}

/**
 * Run the guards every chunk route shares: rate limit, CSRF, authentication.
 *
 * @returns The caller's user id, or a response to return as-is.
 */
export async function guardChunkRequest(
  request: NextRequest,
  { limit }: { limit: number },
): Promise<{ userId: string } | { response: NextResponse }> {
  const rateLimited = await applyRateLimit(request, { limit, windowMs: 60_000 });
  if (rateLimited) return { response: rateLimited };

  const csrfError = checkCsrf(request);
  if (csrfError) return { response: csrfError };

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { response: fail("Unauthorized", 401) };

  return { userId };
}
