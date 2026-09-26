/**
 * Chunked, resumable file upload client (#881).
 *
 * Large uploads used to be a single request: a connection drop at 95% threw
 * away the whole transfer, and there was no retry. This splits a file into
 * fixed-size chunks and uploads them independently, which buys three things:
 *
 * - **Retry** granularity of one chunk instead of one file. A transient
 *   failure costs at most a chunk, not the whole upload.
 * - **Resume** across page reloads. The session id is remembered locally and
 *   the server is asked what it already holds, so only the gaps are re-sent.
 * - **Bounded memory**, since only the chunks in flight are read from disk.
 *
 * Small files keep the single-request path: chunking costs a round trip per
 * chunk plus an assembly pass, which is not worth it below the threshold.
 */

import { withRetry } from "@/app/lib/retryUtils";

/** Size of one chunk, in bytes. Must match the server's `CHUNK_SIZE_BYTES`. */
export const CHUNK_SIZE_BYTES = 5 * 1024 * 1024;

/** Files at or above this size are uploaded in chunks. */
export const CHUNKED_UPLOAD_THRESHOLD_BYTES = 10 * 1024 * 1024;

/** How many chunks of one file are uploaded at once. */
export const CHUNK_CONCURRENCY = 3;

/** Attempts per chunk, including the first. */
export const CHUNK_MAX_ATTEMPTS = 4;

/** localStorage key prefix for resumable session ids. */
const SESSION_STORAGE_PREFIX = "clipcash.upload.session.";

/** Whether `file` is large enough to be worth chunking. */
export function shouldChunk(file: { size: number }): boolean {
  return file.size >= CHUNKED_UPLOAD_THRESHOLD_BYTES;
}

/** Number of chunks `size` bytes will be split into. */
export function chunkCount(size: number): number {
  return Math.max(1, Math.ceil(size / CHUNK_SIZE_BYTES));
}

/**
 * Stable identity for a file across page loads.
 *
 * Name, size and mtime is the most the browser will tell us without reading
 * the file; it is enough to recognise the same file being re-picked, and a
 * false match is caught by the server's per-chunk indexing anyway.
 */
export function fileFingerprint(file: {
  name: string;
  size: number;
  lastModified?: number;
}): string {
  return `${file.name}:${file.size}:${file.lastModified ?? 0}`;
}

/** Result of a completed upload. */
export interface ChunkedUploadResult {
  jobId: string;
  name: string;
  url: string;
}

export interface ChunkedUploadOptions {
  /** Called with 0–100 as chunks complete. */
  onProgress?: (percent: number) => void;
  /** Aborts the upload. Chunks already stored stay stored, so it can resume. */
  signal?: AbortSignal;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}

/** Remembered session id for a file, if one is still recorded. */
function readStoredSession(
  storage: ChunkedUploadOptions["storage"],
  fingerprint: string,
): string | null {
  try {
    return storage?.getItem(SESSION_STORAGE_PREFIX + fingerprint) ?? null;
  } catch {
    // Private-mode or quota errors must not stop an upload; they only cost
    // the ability to resume it.
    return null;
  }
}

function writeStoredSession(
  storage: ChunkedUploadOptions["storage"],
  fingerprint: string,
  sessionId: string,
): void {
  try {
    storage?.setItem(SESSION_STORAGE_PREFIX + fingerprint, sessionId);
  } catch {
    /* resume is best-effort */
  }
}

function clearStoredSession(
  storage: ChunkedUploadOptions["storage"],
  fingerprint: string,
): void {
  try {
    storage?.removeItem(SESSION_STORAGE_PREFIX + fingerprint);
  } catch {
    /* resume is best-effort */
  }
}

/** Read the `error` field out of an API envelope, falling back to the status. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.error ?? `Request failed (HTTP ${response.status})`;
  } catch {
    return `Request failed (HTTP ${response.status})`;
  }
}

/**
 * A failure that retrying cannot fix — a rejected file, a bad session.
 *
 * Client errors other than 408/429 are final: re-sending the same bytes will
 * get the same answer, so the retry loop stops immediately.
 */
export class NonRetryableUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableUploadError";
  }
}

/** Whether an HTTP status is worth another attempt. */
function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

/**
 * Upload one file in chunks, resuming any session already recorded for it.
 *
 * @throws {NonRetryableUploadError} When the server rejects the file itself.
 * @throws {DOMException} `AbortError` when `signal` is aborted.
 */
export async function uploadFileInChunks(
  file: File,
  options: ChunkedUploadOptions = {},
): Promise<ChunkedUploadResult> {
  const {
    onProgress,
    signal,
    fetchImpl = fetch,
    storage = typeof window !== "undefined" ? window.localStorage : undefined,
  } = options;

  const fingerprint = fileFingerprint(file);
  const totalChunks = chunkCount(file.size);

  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw new DOMException("Upload cancelled", "AbortError");
    }
  };

  const request = async (input: string, init: RequestInit) => {
    const response = await fetchImpl(input, { ...init, signal });
    if (!response.ok) {
      const message = await errorMessage(response);
      if (!isRetryableStatus(response.status)) {
        throw new NonRetryableUploadError(message);
      }
      throw new Error(message);
    }
    return response;
  };

  throwIfAborted();

  // ── Resume, or open a new session ─────────────────────────────────────────

  let sessionId = readStoredSession(storage, fingerprint);
  let receivedChunks: number[] = [];

  if (sessionId) {
    try {
      const response = await request(
        `/api/upload/chunk/session?sessionId=${encodeURIComponent(sessionId)}`,
        { method: "GET" },
      );
      const body = await response.json();
      receivedChunks = body?.data?.receivedChunks ?? [];
    } catch (error) {
      if (error instanceof DOMException) throw error;
      // A session the server no longer recognises just means starting over.
      sessionId = null;
      clearStoredSession(storage, fingerprint);
    }
  }

  if (!sessionId) {
    const response = await request("/api/upload/chunk/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
      }),
    });
    const body = await response.json();
    sessionId = body?.data?.sessionId as string;
    receivedChunks = body?.data?.receivedChunks ?? [];
    writeStoredSession(storage, fingerprint, sessionId);
  }

  // ── Send the chunks the server does not already have ──────────────────────

  const alreadyStored = new Set<number>(receivedChunks);
  const pending = Array.from({ length: totalChunks }, (_, i) => i).filter(
    (index) => !alreadyStored.has(index),
  );

  let completed = alreadyStored.size;
  const reportProgress = () => {
    onProgress?.(Math.round((completed / totalChunks) * 100));
  };
  reportProgress();

  const sendChunk = async (index: number) => {
    throwIfAborted();
    const start = index * CHUNK_SIZE_BYTES;
    const blob = file.slice(start, Math.min(start + CHUNK_SIZE_BYTES, file.size));

    await withRetry(
      async () => {
        throwIfAborted();
        await request(
          `/api/upload/chunk?sessionId=${encodeURIComponent(sessionId as string)}&index=${index}`,
          { method: "PUT", body: blob },
        );
      },
      {
        maxAttempts: CHUNK_MAX_ATTEMPTS,
        shouldAbort: (error) =>
          error instanceof NonRetryableUploadError ||
          (error instanceof DOMException && error.name === "AbortError"),
      },
    );

    completed += 1;
    reportProgress();
  };

  // A fixed pool of workers rather than Promise.all over every chunk, so a
  // 500MB file does not open 100 simultaneous requests.
  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      await sendChunk(pending[cursor++]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CHUNK_CONCURRENCY, pending.length) }, worker),
  );

  // ── Finalise ──────────────────────────────────────────────────────────────

  throwIfAborted();

  const response = await withRetry(
    () =>
      request("/api/upload/chunk/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          totalChunks,
        }),
      }),
    {
      maxAttempts: CHUNK_MAX_ATTEMPTS,
      shouldAbort: (error) =>
        error instanceof NonRetryableUploadError ||
        (error instanceof DOMException && error.name === "AbortError"),
    },
  );

  const body = await response.json();
  const payload = body?.data ?? body;

  // The session is spent; a later upload of the same file starts fresh.
  clearStoredSession(storage, fingerprint);
  onProgress?.(100);

  return {
    jobId: payload?.jobId ?? payload?.files?.[0]?.jobId ?? "",
    name: file.name,
    url: payload?.files?.[0]?.url ?? "",
  };
}
