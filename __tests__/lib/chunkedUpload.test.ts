/**
 * Upload reliability tests for the chunked uploader (#881).
 *
 * The point of chunking is what happens when things go wrong, so most of these
 * exercise failure: a chunk that fails and is retried, a connection lost
 * halfway through and resumed, a rejected file that must not be retried, and
 * cancellation mid-flight.
 */

import {
  uploadFileInChunks,
  shouldChunk,
  chunkCount,
  fileFingerprint,
  NonRetryableUploadError,
  CHUNK_SIZE_BYTES,
  CHUNK_MAX_ATTEMPTS,
  CHUNKED_UPLOAD_THRESHOLD_BYTES,
} from "@/app/lib/chunkedUpload";

/** An in-memory stand-in for localStorage. */
function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    get size() {
      return map.size;
    },
  };
}

/** Build a File of `size` bytes without allocating the whole thing eagerly. */
function makeFile(name: string, size: number): File {
  const file = new File([new Uint8Array(0)], name, { type: "video/mp4" });
  Object.defineProperty(file, "size", { value: size });
  Object.defineProperty(file, "lastModified", { value: 1_700_000_000_000 });
  // jsdom's File.slice returns a Blob; the body only needs to be *something*.
  Object.defineProperty(file, "slice", {
    value: (start: number, end: number) =>
      new Blob([new Uint8Array(Math.max(0, end - start))]),
  });
  return file;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const SESSION_ID = "11111111-2222-4333-8444-555555555555";

/**
 * A fake server. Records chunk PUTs and lets a test script failures per URL.
 */
function makeServer(overrides: Partial<{ totalChunks: number }> = {}) {
  const putIndices: number[] = [];
  let completeCalls = 0;

  const handlers = {
    sessionPost: () =>
      jsonResponse({
        data: {
          sessionId: SESSION_ID,
          chunkSize: CHUNK_SIZE_BYTES,
          totalChunks: overrides.totalChunks ?? 0,
          receivedChunks: [],
        },
        error: null,
      }),
    sessionGet: () =>
      jsonResponse({
        data: { sessionId: SESSION_ID, receivedChunks: [] },
        error: null,
      }),
    put: (index: number) => {
      putIndices.push(index);
      return jsonResponse({ data: { index }, error: null });
    },
    complete: () => {
      completeCalls += 1;
      return jsonResponse({
        data: { jobId: "job_abc", files: [{ url: "https://cdn/x.mp4" }] },
        error: null,
      });
    },
  };

  const fetchImpl = jest.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/upload/chunk/session")) {
      return init?.method === "POST"
        ? handlers.sessionPost()
        : handlers.sessionGet();
    }
    if (url.startsWith("/api/upload/chunk/complete")) return handlers.complete();
    if (url.startsWith("/api/upload/chunk?")) {
      const index = Number(new URLSearchParams(url.split("?")[1]).get("index"));
      return handlers.put(index);
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  return {
    fetchImpl,
    handlers,
    get putIndices() {
      return putIndices;
    },
    get completeCalls() {
      return completeCalls;
    },
  };
}

describe("chunk maths", () => {
  it("chunks files at or above the threshold only", () => {
    expect(shouldChunk({ size: CHUNKED_UPLOAD_THRESHOLD_BYTES })).toBe(true);
    expect(shouldChunk({ size: CHUNKED_UPLOAD_THRESHOLD_BYTES + 1 })).toBe(true);
    expect(shouldChunk({ size: CHUNKED_UPLOAD_THRESHOLD_BYTES - 1 })).toBe(false);
    expect(shouldChunk({ size: 0 })).toBe(false);
  });

  it("splits a file into ceil(size / chunkSize) chunks", () => {
    expect(chunkCount(CHUNK_SIZE_BYTES)).toBe(1);
    expect(chunkCount(CHUNK_SIZE_BYTES + 1)).toBe(2);
    expect(chunkCount(CHUNK_SIZE_BYTES * 4)).toBe(4);
    // A zero-length file still counts as one chunk rather than none.
    expect(chunkCount(0)).toBe(1);
  });

  it("fingerprints a file by name, size and mtime", () => {
    const a = { name: "clip.mp4", size: 10, lastModified: 5 };
    expect(fileFingerprint(a)).toBe("clip.mp4:10:5");
    expect(fileFingerprint({ ...a, size: 11 })).not.toBe(fileFingerprint(a));
  });
});

describe("uploadFileInChunks", () => {
  it("uploads every chunk exactly once and completes the session", async () => {
    const server = makeServer();
    const file = makeFile("clip.mp4", CHUNK_SIZE_BYTES * 3);

    const result = await uploadFileInChunks(file, {
      fetchImpl: server.fetchImpl as unknown as typeof fetch,
      storage: makeStorage(),
    });

    expect([...server.putIndices].sort()).toEqual([0, 1, 2]);
    expect(server.completeCalls).toBe(1);
    expect(result).toEqual({
      jobId: "job_abc",
      name: "clip.mp4",
      url: "https://cdn/x.mp4",
    });
  });

  it("reports progress from 0 to 100 as chunks land", async () => {
    const server = makeServer();
    const file = makeFile("clip.mp4", CHUNK_SIZE_BYTES * 4);
    const progress: number[] = [];

    await uploadFileInChunks(file, {
      fetchImpl: server.fetchImpl as unknown as typeof fetch,
      storage: makeStorage(),
      onProgress: (p) => progress.push(p),
    });

    expect(progress[0]).toBe(0);
    expect(progress[progress.length - 1]).toBe(100);
    // Monotonic — progress must never go backwards.
    expect([...progress].sort((a, b) => a - b)).toEqual(progress);
  });

  it("retries a chunk that fails transiently, without re-sending the others", async () => {
    const server = makeServer();
    const file = makeFile("clip.mp4", CHUNK_SIZE_BYTES * 2);

    let failures = 0;
    const originalPut = server.handlers.put;
    server.handlers.put = (index: number) => {
      if (index === 1 && failures < 2) {
        failures += 1;
        return jsonResponse({ error: "upstream blip" }, 503);
      }
      return originalPut(index);
    };

    await uploadFileInChunks(file, {
      fetchImpl: server.fetchImpl as unknown as typeof fetch,
      storage: makeStorage(),
    });

    expect(failures).toBe(2);
    // Chunk 1 eventually lands; chunk 0 was never re-sent.
    expect(server.putIndices.filter((i) => i === 0)).toHaveLength(1);
    expect(server.putIndices).toContain(1);
    expect(server.completeCalls).toBe(1);
  });

  it("gives up on a chunk once its attempts are exhausted", async () => {
    const server = makeServer();
    const file = makeFile("clip.mp4", CHUNK_SIZE_BYTES * 2);

    server.handlers.put = () => jsonResponse({ error: "still down" }, 503);

    await expect(
      uploadFileInChunks(file, {
        fetchImpl: server.fetchImpl as unknown as typeof fetch,
        storage: makeStorage(),
      }),
    ).rejects.toThrow("still down");

    expect(server.completeCalls).toBe(0);
  });

  it("does not retry a file the server rejected outright", async () => {
    const server = makeServer();
    const chunks = 2;
    const file = makeFile("clip.mp4", CHUNK_SIZE_BYTES * chunks);

    let attempts = 0;
    server.handlers.put = () => {
      attempts += 1;
      return jsonResponse({ error: "unsupported format" }, 400);
    };

    await expect(
      uploadFileInChunks(file, {
        fetchImpl: server.fetchImpl as unknown as typeof fetch,
        storage: makeStorage(),
      }),
    ).rejects.toBeInstanceOf(NonRetryableUploadError);

    // Both chunks are already in flight when the rejection lands, so one
    // attempt each. What matters is that neither was retried — with the retry
    // loop engaged this would be chunks * CHUNK_MAX_ATTEMPTS.
    expect(attempts).toBe(chunks);
    expect(attempts).toBeLessThan(chunks * CHUNK_MAX_ATTEMPTS);
    expect(server.completeCalls).toBe(0);
  });

  it("resumes a recorded session, re-sending only the missing chunks", async () => {
    const server = makeServer();
    const file = makeFile("clip.mp4", CHUNK_SIZE_BYTES * 4);
    const storage = makeStorage({
      [`clipcash.upload.session.${fileFingerprint(file)}`]: SESSION_ID,
    });

    server.handlers.sessionGet = () =>
      jsonResponse({
        data: { sessionId: SESSION_ID, receivedChunks: [0, 1] },
        error: null,
      });

    const progress: number[] = [];
    await uploadFileInChunks(file, {
      fetchImpl: server.fetchImpl as unknown as typeof fetch,
      storage,
      onProgress: (p) => progress.push(p),
    });

    // Only the gap is re-sent, and progress starts from what was already there.
    expect([...server.putIndices].sort()).toEqual([2, 3]);
    expect(progress[0]).toBe(50);
    expect(server.completeCalls).toBe(1);
  });

  it("starts a fresh session when the recorded one is gone", async () => {
    const server = makeServer();
    const file = makeFile("clip.mp4", CHUNK_SIZE_BYTES * 2);
    const storage = makeStorage({
      [`clipcash.upload.session.${fileFingerprint(file)}`]: SESSION_ID,
    });

    server.handlers.sessionGet = () =>
      jsonResponse({ error: "unknown session" }, 404);

    await uploadFileInChunks(file, {
      fetchImpl: server.fetchImpl as unknown as typeof fetch,
      storage,
    });

    expect([...server.putIndices].sort()).toEqual([0, 1]);
    expect(server.completeCalls).toBe(1);
  });

  it("records the session while uploading and clears it once complete", async () => {
    const server = makeServer();
    const file = makeFile("clip.mp4", CHUNK_SIZE_BYTES * 2);
    const storage = makeStorage();

    const key = `clipcash.upload.session.${fileFingerprint(file)}`;
    server.handlers.put = (index: number) => {
      // Mid-flight the id must be on disk, or a reload could not resume.
      expect(storage.getItem(key)).toBe(SESSION_ID);
      return jsonResponse({ data: { index } }, 200);
    };

    await uploadFileInChunks(file, {
      fetchImpl: server.fetchImpl as unknown as typeof fetch,
      storage,
    });

    expect(storage.getItem(key)).toBeNull();
  });

  it("survives storage being unavailable", async () => {
    const server = makeServer();
    const file = makeFile("clip.mp4", CHUNK_SIZE_BYTES * 2);
    const storage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };

    await expect(
      uploadFileInChunks(file, {
        fetchImpl: server.fetchImpl as unknown as typeof fetch,
        storage,
      }),
    ).resolves.toMatchObject({ jobId: "job_abc" });
  });

  it("stops on cancellation and does not complete the session", async () => {
    const server = makeServer();
    const file = makeFile("clip.mp4", CHUNK_SIZE_BYTES * 4);
    const controller = new AbortController();

    server.handlers.put = (index: number) => {
      controller.abort();
      return jsonResponse({ data: { index } }, 200);
    };

    await expect(
      uploadFileInChunks(file, {
        fetchImpl: server.fetchImpl as unknown as typeof fetch,
        storage: makeStorage(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(server.completeCalls).toBe(0);
  });

  it("retries a completion that fails transiently", async () => {
    const server = makeServer();
    const file = makeFile("clip.mp4", CHUNK_SIZE_BYTES * 2);

    let completeAttempts = 0;
    const originalComplete = server.handlers.complete;
    server.handlers.complete = () => {
      completeAttempts += 1;
      if (completeAttempts === 1) {
        return jsonResponse({ error: "assembly busy" }, 503);
      }
      return originalComplete();
    };

    const result = await uploadFileInChunks(file, {
      fetchImpl: server.fetchImpl as unknown as typeof fetch,
      storage: makeStorage(),
    });

    expect(completeAttempts).toBe(2);
    expect(result.jobId).toBe("job_abc");
  });
});
