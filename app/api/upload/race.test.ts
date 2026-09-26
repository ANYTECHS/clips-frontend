/**
 * Race condition tests for the upload route (#1085).
 *
 * Verifies that:
 * 1. jobStore.set is awaited before dispatchJob — the AI backend callback
 *    must never arrive before the job exists in the store.
 * 2. Concurrent file processing is capped so the virus-scan circuit breaker
 *    and S3 connection pool are not saturated under burst load.
 */

// Importing from our own source gives the TS language server enough module
// context to resolve ambient Jest globals (@types/jest) without node_modules.
import { UPLOAD_PROCESSING_CONCURRENCY } from "@/app/lib/constants";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockJobStoreSet = jest.fn().mockResolvedValue(undefined);
const mockDispatchJob = jest.fn().mockResolvedValue({ dispatched: true });
const mockProcessUploadedBuffer = jest.fn();
const mockApplyCustomRateLimit = jest.fn().mockResolvedValue(null);
const mockCheckCsrf = jest.fn().mockReturnValue(null);
const mockAuth = jest.fn().mockResolvedValue({ user: { id: "user-123" } });
const mockGetScanConfig = jest.fn().mockReturnValue({ enabled: true, provider: "disabled" });
const mockTemplatesStoreGetSettings = jest.fn().mockReturnValue(null);

jest.mock("@/app/api/jobs/shared/jobStore", () => ({
  jobStore: { set: mockJobStoreSet },
}));
jest.mock("@/app/lib/aiBackend", () => ({
  dispatchJob: mockDispatchJob,
}));
jest.mock("@/app/api/upload/shared/processUpload", () => ({
  processUploadedBuffer: mockProcessUploadedBuffer,
  validateMagicBytes: jest.fn().mockReturnValue(null),
  ALLOWED_TYPES: ["video/mp4"],
  ALLOWED_EXTENSIONS: [".mp4"],
}));
jest.mock("@/app/lib/customRateLimit", () => ({
  applyCustomRateLimit: mockApplyCustomRateLimit,
}));
jest.mock("@/app/lib/csrf", () => ({
  checkCsrf: mockCheckCsrf,
}));
jest.mock("@/app/lib/auth", () => ({
  auth: mockAuth,
}));
jest.mock("@/app/lib/virusScan", () => ({
  getScanConfig: mockGetScanConfig,
}));
jest.mock("@/app/api/templates/templatesStore", () => ({
  templatesStore: { getSettings: mockTemplatesStoreGetSettings },
}));
jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(name: string, type = "video/mp4"): File {
  return new File([new Uint8Array(12).fill(0)], name, { type });
}

function makeResult(jobId: string, name: string) {
  return {
    jobId,
    name,
    type: "video/mp4",
    objectKey: `uploads/${jobId}.mp4`,
    url: `https://bucket.s3.amazonaws.com/uploads/${jobId}.mp4`,
    size: 12,
  };
}

function makeRequest(files: File[]): Request {
  const formData = new FormData();
  for (const f of files) formData.append("files", f);
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: formData,
    headers: {
      "x-csrf-token": "valid",
    },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("upload route — job registration ordering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApplyCustomRateLimit.mockResolvedValue(null);
    mockCheckCsrf.mockReturnValue(null);
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockGetScanConfig.mockReturnValue({ enabled: false, provider: "disabled" });
    mockTemplatesStoreGetSettings.mockReturnValue(null);
  });

  it("awaits jobStore.set before calling dispatchJob for a single file", async () => {
    const order: string[] = [];

    mockProcessUploadedBuffer.mockResolvedValueOnce(makeResult("job_a", "a.mp4"));
    mockJobStoreSet.mockImplementationOnce(async () => {
      order.push("set");
    });
    mockDispatchJob.mockImplementationOnce(async () => {
      order.push("dispatch");
      return { dispatched: true };
    });

    const { POST } = await import("./route");
    const req = makeRequest([makeFile("a.mp4")]);
    await POST(req as never);

    expect(order).toEqual(["set", "dispatch"]);
  });

  it("awaits jobStore.set before dispatchJob for every file in a multi-file upload", async () => {
    const order: string[] = [];

    for (const id of ["job_a", "job_b", "job_c"]) {
      const name = `${id.slice(4)}.mp4`;
      mockProcessUploadedBuffer.mockResolvedValueOnce(makeResult(id, name));
    }

    mockJobStoreSet.mockImplementation(async (id: string) => {
      order.push(`set:${id}`);
    });
    mockDispatchJob.mockImplementation(async (payload: { jobId: string }) => {
      order.push(`dispatch:${payload.jobId}`);
      return { dispatched: true };
    });

    const { POST } = await import("./route");
    const req = makeRequest([
      makeFile("a.mp4"),
      makeFile("b.mp4"),
      makeFile("c.mp4"),
    ]);
    await POST(req as never);

    // For every job, set must appear before dispatch in the sequence
    for (const id of ["job_a", "job_b", "job_c"]) {
      const setIdx = order.indexOf(`set:${id}`);
      const dispatchIdx = order.indexOf(`dispatch:${id}`);
      expect(setIdx).toBeGreaterThanOrEqual(0);
      expect(dispatchIdx).toBeGreaterThanOrEqual(0);
      expect(setIdx).toBeLessThan(dispatchIdx);
    }
  });

  it("dispatched jobId is retrievable from the store at callback time", async () => {
    // Simulates the AI backend calling back immediately after dispatchJob resolves.
    // The job must be findable in the store at that point.
    const storedJobs = new Map<string, unknown>();

    mockProcessUploadedBuffer.mockResolvedValueOnce(makeResult("job_cb", "cb.mp4"));
    mockJobStoreSet.mockImplementationOnce(async (id: string, job: unknown) => {
      storedJobs.set(id, job);
    });
    mockDispatchJob.mockImplementationOnce(async () => {
      // Simulate callback arriving synchronously after dispatch
      expect(storedJobs.has("job_cb")).toBe(true);
      return { dispatched: true };
    });

    const { POST } = await import("./route");
    await POST(makeRequest([makeFile("cb.mp4")]) as never);

    expect(storedJobs.has("job_cb")).toBe(true);
  });

  it("returns 200 with all jobIds even when dispatch fails", async () => {
    mockProcessUploadedBuffer
      .mockResolvedValueOnce(makeResult("job_x", "x.mp4"))
      .mockResolvedValueOnce(makeResult("job_y", "y.mp4"));
    mockJobStoreSet.mockResolvedValue(undefined);
    mockDispatchJob.mockResolvedValue({ dispatched: false, reason: "AI_API_URL_NOT_CONFIGURED" });

    const { POST } = await import("./route");
    const res = await POST(makeRequest([makeFile("x.mp4"), makeFile("y.mp4")]) as never);
    const body = await res.json() as { data: { files: { jobId: string }[] } };

    expect(res.status).toBe(200);
    expect(body.data.files).toHaveLength(2);
  });
});

describe("upload route — concurrent processing cap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApplyCustomRateLimit.mockResolvedValue(null);
    mockCheckCsrf.mockReturnValue(null);
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockGetScanConfig.mockReturnValue({ enabled: false, provider: "disabled" });
    mockJobStoreSet.mockResolvedValue(undefined);
    mockDispatchJob.mockResolvedValue({ dispatched: true });
    mockTemplatesStoreGetSettings.mockReturnValue(null);
  });

  it("never processes more than UPLOAD_PROCESSING_CONCURRENCY files simultaneously", async () => {

    let inflight = 0;
    let maxInflight = 0;

    const fileCount = UPLOAD_PROCESSING_CONCURRENCY + 3; // deliberately over the cap

    for (let i = 0; i < fileCount; i++) {
      mockProcessUploadedBuffer.mockImplementationOnce(async () => {
        inflight++;
        maxInflight = Math.max(maxInflight, inflight);
        await new Promise<void>((r) => setTimeout(r, 0)); // yield to event loop
        inflight--;
        return makeResult(`job_${i}`, `file_${i}.mp4`);
      });
    }

    const { POST } = await import("./route");
    const files = Array.from({ length: fileCount }, (_, i) => makeFile(`file_${i}.mp4`));
    await POST(makeRequest(files) as never);

    expect(maxInflight).toBeLessThanOrEqual(UPLOAD_PROCESSING_CONCURRENCY);
  });

  it("still processes all files even when count exceeds concurrency cap", async () => {
    const fileCount = 7;

    for (let i = 0; i < fileCount; i++) {
      mockProcessUploadedBuffer.mockImplementationOnce(
        async () => makeResult(`job_${i}`, `file_${i}.mp4`),
      );
    }

    const { POST } = await import("./route");
    const files = Array.from({ length: fileCount }, (_, i) => makeFile(`file_${i}.mp4`));
    const res = await POST(makeRequest(files) as never);
    const body = await res.json() as { data: { files: unknown[] } };

    expect(res.status).toBe(200);
    expect(body.data.files).toHaveLength(fileCount);
    expect(mockProcessUploadedBuffer).toHaveBeenCalledTimes(fileCount);
  });
});
