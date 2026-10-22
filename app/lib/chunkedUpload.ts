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
 * Each chunk (and the final assembly request) is wrapped in
 * `retryWithBackoff()`: 1s doubling to a 30s cap with 0–50% jitter, so a
 * fleet of clients that lost the server together doesn't hammer it in
 * lockstep when it comes back. 400/401/403/413 fail immediately; network
 * errors and 5xx retry, up to CHUNK_MAX_RETRIES times.
 *
 * Small files keep the single-request path: chunking costs a round trip per
 * chunk plus an assembly pass, which is not worth it below the threshold.
 */

import { isRetryableStatus, retryWithBackoff, type RetryOptions } from "@/app/lib/retry";

/** Size of one chunk, in bytes. Must match the server's `CHUNK_SIZE_BYTES`. */
export const CHUNK_SIZE_BYTES = 5 * 1024 * 1024;

/** Files at or above this size are uploaded in chunks. */
export const CHUNKED_UPLOAD_THRESHOLD_BYTES = 10 * 1024 * 1024;

/** How many chunks of one file are uploaded at once. */
export const CHUNK_CONCURRENCY = 3;

/** Retries per chunk after the first attempt fails. */
export const CHUNK_MAX_RETRIES = 3;

/** Attempts per chunk, including the first. */
export const CHUNK_MAX_ATTEMPTS = CHUNK_MAX_RETRIES + 1;

/** localStorage key prefix for resumable session ids. */
const SESSION_STORAGE_PREFIX = "clipcash.upload.session.";

/** Whether `file` is large enough to be worth chunking. */
export function shouldChunk(file: { size: number }): boolean {
  return file.size >= CHUNKED_UPLOAD_THRESHOLD_BYTES;
}

/** Number of chunks `size` bytes will be split into. */
export function chunkCount(size: number, chunkSize = CHUNK_SIZE_BYTES): number {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new RangeError("chunkSize must be a positive integer");
  }
  return Math.max(1, Math.ceil(size / chunkSize));
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

/** Details of a chunk retry, for "Retrying chunk X (attempt Y)..." UI. */
export interface ChunkRetryInfo {
  /** 0-based chunk index. */
  chunkIndex: number;
  /** 1-based chunk number, for display. */
  chunkNumber: number;
  totalChunks: number;
  /** The attempt about to be made (2 for the first retry). */
  attempt: number;
  maxAttempts: number;
  /** Backoff before that attempt, in ms (jitter included). */
  delayMs: number;
  error: unknown;
}

/** "Retrying chunk 3 (attempt 2)..." */
export function formatChunkRetryMessage(info: Pick<ChunkRetryInfo, "chunkNumber" | "attempt">): string {
  return `Retrying chunk ${info.chunkNumber} (attempt ${info.attempt})...`;
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
  /** Chunk size in bytes. Defaults to 5 MiB and cannot exceed the server limit. */
  chunkSize?: number;
  /** Aborts the upload. Chunks already stored stay stored, so it can resume. */
  signal?: AbortSignal;
  /** Optional saved template applied to the assembled upload. */
  templateId?: string;
  /** Called before each chunk retry, after the backoff delay is chosen. */
  onChunkRetry?: (info: ChunkRetryInfo) => void;
  /** Called when a chunk has been stored, e.g. to clear its retry notice. */
  onChunkComplete?: (chunkIndex: number) => void;
  /**
   * Overrides for the backoff (`maxRetries` defaults to CHUNK_MAX_RETRIES).
   * Mostly for tests, which inject short delays and a fixed `random`.
   */
  retry?: Pick<RetryOptions, "maxRetries" | "baseDelayMs" | "maxDelayMs" | "jitterRatio" | "random">;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests. */
  xhrFactory?: () => XMLHttpRequest;
  /** Injectable for tests. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}

/** Remembered session id for a file, if one is still recorded. */
function readStoredSession(
  storage: ChunkedUploadOptions["storage"],
  fingerprint: string
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
  sessionId: string
): void {
  try {
    storage?.setItem(SESSION_STORAGE_PREFIX + fingerprint, sessionId);
  } catch {
    /* resume is best-effort */
  }
}

function clearStoredSession(storage: ChunkedUploadOptions["storage"], fingerprint: string): void {
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
 * Client errors other than 408/429 (notably 400, 401, 403 and 413) are final:
 * re-sending the same bytes will get the same answer, so the retry loop stops
 * immediately.
 */
export class NonRetryableUploadError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "NonRetryableUploadError";
  }
}

/** A transient failure (network error, 5xx) that the backoff loop retries. */
export class RetryableUploadError extends Error {
  /** HTTP status, or 0 for network errors and timeouts. */
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "RetryableUploadError";
  }
}

/** Raised once a chunk has used up every retry. Wraps the last failure. */
export class ChunkUploadFailedError extends Error {
  constructor(
    message: string,
    readonly chunkIndex: number,
    readonly attempts: number,
    readonly lastError: unknown
  ) {
    super(message);
    this.name = "ChunkUploadFailedError";
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException || error instanceof Error) &&
    (error as { name?: string }).name === "AbortError"
  );
}

/** Retry anything except rejections the server will repeat, and cancellations. */
function shouldRetryUpload(error: unknown): boolean {
  return !(error instanceof NonRetryableUploadError) && !isAbortError(error);
}

/**
 * Upload one file in chunks, resuming any session already recorded for it.
 *
 * @throws {NonRetryableUploadError} When the server rejects the file itself.
 * @throws {DOMException} `AbortError` when `signal` is aborted.
 */
export async function uploadFileInChunks(
  file: File,
  options: ChunkedUploadOptions = {}
): Promise<ChunkedUploadResult> {
  const {
    onProgress,
    signal,
    chunkSize = CHUNK_SIZE_BYTES,
    fetchImpl = fetch,
    xhrFactory = () => new XMLHttpRequest(),
    storage = typeof window !== "undefined" ? window.localStorage : undefined,
  } = options;

  if (!Number.isInteger(chunkSize) || chunkSize <= 0 || chunkSize > CHUNK_SIZE_BYTES) {
    throw new RangeError(`chunkSize must be between 1 and ${CHUNK_SIZE_BYTES} bytes`);
  }

  const fingerprint = fileFingerprint(file);
  const totalChunks = chunkCount(file.size, chunkSize);

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
        throw new NonRetryableUploadError(message, response.status);
      }
      throw new RetryableUploadError(message, response.status);
    }
    return response;
  };

  throwIfAborted();

  // ── Resume, or open a new session ─────────────────────────────────────────

  let sessionId = readStoredSession(storage, fingerprint);
  let receivedChunks: number[] = [];

  if (sessionId) {
    try {
      const response = await request(`/api/upload/resume?jobId=${encodeURIComponent(sessionId)}`, {
        method: "GET",
      });
      const body = await response.json();
      receivedChunks = body?.data?.receivedChunkIndices ?? body?.data?.receivedChunks ?? [];
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
        chunkSize,
      }),
    });
    const body = await response.json();
    sessionId = body?.data?.sessionId as string;
    receivedChunks = body?.data?.receivedChunks ?? [];
    writeStoredSession(storage, fingerprint, sessionId);
  }

  // ── Send the chunks the server does not already have ──────────────────────

  const alreadyStored = new Set<number>(
    receivedChunks.filter(
      (index: number) => Number.isInteger(index) && index >= 0 && index < totalChunks
    )
  );
  const pending = Array.from(Array(totalChunks).keys()).filter(
    (index) => !alreadyStored.has(index)
  );

  const completedChunks = new Set(alreadyStored);
  const activeChunkBytes = new Map<number, number>();
  let lastReportedProgress = 0;
  const chunkBytes = (index: number) =>
    Math.max(0, Math.min(chunkSize, file.size - index * chunkSize));
  const reportProgress = () => {
    const completedBytes = [...completedChunks].reduce(
      (total, index) => total + chunkBytes(index),
      0
    );
    const activeBytes = [...activeChunkBytes.values()].reduce((total, bytes) => total + bytes, 0);
    const currentProgress =
      file.size > 0 ? Math.round(((completedBytes + activeBytes) / file.size) * 100) : 100;
    lastReportedProgress = Math.max(lastReportedProgress, currentProgress);
    onProgress?.(lastReportedProgress);
  };
  reportProgress();

  const maxRetries = options.retry?.maxRetries ?? CHUNK_MAX_RETRIES;
  const backoff: RetryOptions = {
    ...options.retry,
    maxRetries,
    signal,
    shouldRetry: shouldRetryUpload,
  };

  const sendChunk = async (index: number) => {
    throwIfAborted();
    const start = index * chunkSize;
    const blob = file.slice(start, Math.min(start + chunkSize, file.size));

    try {
      await retryWithBackoff(
        async () => {
          throwIfAborted();
          activeChunkBytes.set(index, 0);
          await new Promise<void>((resolve, reject) => {
            const xhr = xhrFactory();
            let settled = false;
            const finish = (error?: Error) => {
              if (settled) return;
              settled = true;
              signal?.removeEventListener("abort", abortRequest);
              if (error) reject(error);
              else resolve();
            };
            const abortRequest = () => xhr.abort();

            if (signal?.aborted) {
              finish(new DOMException("Upload cancelled", "AbortError"));
              return;
            }

            xhr.open(
              "PUT",
              `/api/upload/chunk?sessionId=${encodeURIComponent(sessionId as string)}&index=${index}`
            );
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                activeChunkBytes.set(index, Math.min(event.loaded, blob.size));
                reportProgress();
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                finish();
                return;
              }

              let message = `Chunk upload failed (HTTP ${xhr.status})`;
              try {
                const body = JSON.parse(xhr.responseText);
                message = body?.error ?? body?.data?.error ?? message;
              } catch {
                // Keep the status-based message when the response is not JSON.
              }
              finish(
                isRetryableStatus(xhr.status)
                  ? new RetryableUploadError(message, xhr.status)
                  : new NonRetryableUploadError(message, xhr.status)
              );
            };
            xhr.onerror = () =>
              finish(new RetryableUploadError("Network error during chunk upload", 0));
            xhr.ontimeout = () => finish(new RetryableUploadError("Chunk upload timed out", 0));
            xhr.onabort = () => finish(new DOMException("Upload cancelled", "AbortError"));
            signal?.addEventListener("abort", abortRequest, { once: true });
            xhr.send(blob);
          });
        },
        {
          ...backoff,
          onRetry: (error, retry, delayMs) => {
            // The partially-sent bytes of the failed attempt no longer count.
            activeChunkBytes.set(index, 0);
            options.onChunkRetry?.({
              chunkIndex: index,
              chunkNumber: index + 1,
              totalChunks,
              attempt: retry + 1,
              maxAttempts: maxRetries + 1,
              delayMs,
              error,
            });
          },
        }
      );
    } catch (error) {
      activeChunkBytes.delete(index);
      if (isAbortError(error) || error instanceof NonRetryableUploadError) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw new ChunkUploadFailedError(
        `Upload failed: chunk ${index + 1} of ${totalChunks} could not be sent after ` +
          `${maxRetries} ${maxRetries === 1 ? "retry" : "retries"} (${reason}). ` +
          "Check your connection and retry the upload — chunks already sent will be kept.",
        index,
        maxRetries + 1,
        error
      );
    }

    activeChunkBytes.delete(index);
    completedChunks.add(index);
    options.onChunkComplete?.(index);
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
  await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, pending.length) }, worker));

  // ── Finalise ──────────────────────────────────────────────────────────────

  throwIfAborted();

  const response = await retryWithBackoff(
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
          ...(options.templateId ? { templateId: options.templateId } : {}),
        }),
      }),
    backoff
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
