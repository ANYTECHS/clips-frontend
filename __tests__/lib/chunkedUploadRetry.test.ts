/**
 * Chunk retry behaviour for the chunked uploader: every chunk goes through
 * `retryWithBackoff`, transient statuses retry, rejections fail immediately,
 * and exhausting the retries produces a clear error.
 */

import {
  CHUNK_MAX_RETRIES,
  CHUNK_SIZE_BYTES,
  ChunkUploadFailedError,
  NonRetryableUploadError,
  formatChunkRetryMessage,
  uploadFileInChunks,
  type ChunkRetryInfo,
} from "@/app/lib/chunkedUpload";

const SESSION_ID = "11111111-2222-4333-8444-555555555555";

function makeFile(name: string, size: number): File {
  const file = new File([new Uint8Array(0)], name, { type: "video/mp4" });
  Object.defineProperty(file, "size", { value: size });
  Object.defineProperty(file, "lastModified", { value: 1_700_000_000_000 });
  Object.defineProperty(file, "slice", {
    value: (start: number, end: number) => new Blob([new Uint8Array(Math.max(0, end - start))]),
  });
  return file;
}

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

/** What a chunk PUT should do: an HTTP status, or "network" for a dropped connection. */
type ChunkOutcome = number | "network";

/**
 * A fake XHR server. `script(index, attempt)` decides each chunk attempt's
 * outcome; every attempt is recorded.
 */
function makeXhrServer(script: (index: number, attempt: number) => ChunkOutcome) {
  const attempts = new Map<number, number>();

  const xhrFactory = () => {
    const xhr = {
      status: 0,
      responseText: "",
      upload: { onprogress: null as ((e: ProgressEvent) => void) | null },
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      ontimeout: null as (() => void) | null,
      onabort: null as (() => void) | null,
      url: "",
      open(_method: string, url: string) {
        xhr.url = url;
      },
      abort() {
        xhr.onabort?.();
      },
      send() {
        const index = Number(new URLSearchParams(xhr.url.split("?")[1]).get("index"));
        const attempt = (attempts.get(index) ?? 0) + 1;
        attempts.set(index, attempt);
        const outcome = script(index, attempt);
        queueMicrotask(() => {
          if (outcome === "network") {
            xhr.onerror?.();
            return;
          }
          xhr.status = outcome;
          xhr.responseText = JSON.stringify(
            outcome < 300 ? { data: { index } } : { error: `HTTP ${outcome} from server` }
          );
          xhr.onload?.();
        });
      },
    };
    return xhr as unknown as XMLHttpRequest;
  };

  let completeCalls = 0;
  const fetchImpl = jest.fn(async (input: string) => {
    const url = String(input);
    if (url.startsWith("/api/upload/chunk/session")) {
      return jsonResponse({ data: { sessionId: SESSION_ID, receivedChunks: [] } });
    }
    if (url.startsWith("/api/upload/chunk/complete")) {
      completeCalls += 1;
      return jsonResponse({ data: { jobId: "job_abc", files: [{ url: "https://cdn/x.mp4" }] } });
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  return {
    xhrFactory,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    attemptsFor: (index: number) => attempts.get(index) ?? 0,
    get completeCalls() {
      return completeCalls;
    },
  };
}

/** Near-zero backoff keeps tests fast; the delays themselves are covered in retry.test.ts. */
const fastRetry = { baseDelayMs: 1, maxDelayMs: 1, jitterRatio: 0 };

function upload(server: ReturnType<typeof makeXhrServer>, chunks: number, extra = {}) {
  return uploadFileInChunks(makeFile("clip.mp4", CHUNK_SIZE_BYTES * chunks), {
    fetchImpl: server.fetchImpl,
    xhrFactory: server.xhrFactory,
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    retry: fastRetry,
    ...extra,
  });
}

describe("chunk upload retries", () => {
  it.each([500, 502, 503, 504])("retries a chunk that fails with %i", async (status) => {
    const server = makeXhrServer((index, attempt) => (index === 1 && attempt < 3 ? status : 200));

    await expect(upload(server, 2)).resolves.toMatchObject({ jobId: "job_abc" });

    expect(server.attemptsFor(0)).toBe(1);
    expect(server.attemptsFor(1)).toBe(3);
    expect(server.completeCalls).toBe(1);
  });

  it("retries a chunk after a network error", async () => {
    const server = makeXhrServer((index, attempt) => (index === 0 && attempt === 1 ? "network" : 200));

    await expect(upload(server, 1)).resolves.toMatchObject({ jobId: "job_abc" });
    expect(server.attemptsFor(0)).toBe(2);
  });

  it.each([400, 401, 403, 413])("fails immediately without retrying on %i", async (status) => {
    const server = makeXhrServer(() => status);

    await expect(upload(server, 1)).rejects.toBeInstanceOf(NonRetryableUploadError);

    expect(server.attemptsFor(0)).toBe(1);
    expect(server.completeCalls).toBe(0);
  });

  it(`fails with a clear error after ${CHUNK_MAX_RETRIES} retries by default`, async () => {
    const server = makeXhrServer(() => 503);

    const error = await upload(server, 1).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ChunkUploadFailedError);
    expect((error as Error).message).toMatch(/chunk 1 of 1 could not be sent after 3 retries/);
    expect((error as Error).message).toContain("HTTP 503 from server");
    expect(server.attemptsFor(0)).toBe(CHUNK_MAX_RETRIES + 1);
    expect(server.completeCalls).toBe(0);
  });

  it("honours a custom retry limit", async () => {
    const server = makeXhrServer(() => 500);

    await expect(upload(server, 1, { retry: { ...fastRetry, maxRetries: 1 } })).rejects.toThrow(
      /after 1 retry/
    );
    expect(server.attemptsFor(0)).toBe(2);
  });

  it("reports each retry with the chunk number and attempt", async () => {
    const server = makeXhrServer((index, attempt) => (index === 2 && attempt <= 2 ? 502 : 200));
    const retries: ChunkRetryInfo[] = [];
    const completed: number[] = [];

    await upload(server, 3, {
      onChunkRetry: (info: ChunkRetryInfo) => retries.push(info),
      onChunkComplete: (index: number) => completed.push(index),
    });

    expect(retries.map((r) => formatChunkRetryMessage(r))).toEqual([
      "Retrying chunk 3 (attempt 2)...",
      "Retrying chunk 3 (attempt 3)...",
    ]);
    expect(retries[0]).toMatchObject({ chunkIndex: 2, totalChunks: 3, maxAttempts: 4 });
    expect(completed.sort()).toEqual([0, 1, 2]);
  });
});
