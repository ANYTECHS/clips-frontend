/**
 * @jest-environment node
 *
 * Integration tests for POST /api/jobs/[id]/callback
 *
 * This route is called by the AI backend to report job progress. It is the
 * sole writer of job status into the job store.
 */
import { NextRequest } from "next/server";
import { POST as callbackPOST } from "@/app/api/jobs/[id]/callback/route";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import type { Job } from "@/app/api/jobs/shared/jobStore";

const CALLBACK_SECRET = "test-callback-secret-abc123";
const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

const baseJob: Job = {
  id: "job1",
  userId: "user-owner",
  status: "queued",
  progress: 0,
  momentsFound: 0,
  estimatedSecondsRemaining: 0,
  createdAt: Date.now(),
};

function makeRequest(
  body: object,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest("http://localhost/api/jobs/job1/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function authHeader(secret = CALLBACK_SECRET) {
  return { Authorization: `Bearer ${secret}` };
}

beforeEach(() => {
  process.env.AI_BACKEND_CALLBACK_SECRET = CALLBACK_SECRET;
  process.env.NODE_ENV = "test";
  jobStore.clear();
  jobStore.set("job1", { ...baseJob });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Authentication ───────────────────────────────────────────────────────────

describe("authentication", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await callbackPOST(
      makeRequest({ status: "processing" }),
      makeContext("job1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when the secret is wrong", async () => {
    const res = await callbackPOST(
      makeRequest({ status: "processing" }, authHeader("wrong-secret")),
      makeContext("job1")
    );
    expect(res.status).toBe(401);
  });

  it("accepts requests with the correct secret", async () => {
    const res = await callbackPOST(
      makeRequest({ status: "processing", progress: 10 }, authHeader()),
      makeContext("job1")
    );
    expect(res.status).toBe(200);
  });

  it("accepts unauthenticated requests in development when secret is not set", async () => {
    delete process.env.AI_BACKEND_CALLBACK_SECRET;
    process.env.NODE_ENV = "development";
    const res = await callbackPOST(
      makeRequest({ status: "processing" }),
      makeContext("job1")
    );
    expect(res.status).toBe(200);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("AI_BACKEND_CALLBACK_SECRET is not set")
    );
  });

  it("rejects all requests in production when secret is not set", async () => {
    delete process.env.AI_BACKEND_CALLBACK_SECRET;
    process.env.NODE_ENV = "production";
    const res = await callbackPOST(
      makeRequest({ status: "processing" }),
      makeContext("job1")
    );
    expect(res.status).toBe(401);
  });
});

// ─── Job not found ────────────────────────────────────────────────────────────

describe("job lookup", () => {
  it("returns 404 for an unknown job id", async () => {
    const res = await callbackPOST(
      makeRequest({ status: "processing" }, authHeader()),
      makeContext("nonexistent")
    );
    expect(res.status).toBe(404);
  });
});

// ─── Progress updates ─────────────────────────────────────────────────────────

describe("progress updates", () => {
  it("updates status to processing", async () => {
    await callbackPOST(
      makeRequest({ status: "processing", progress: 25 }, authHeader()),
      makeContext("job1")
    );
    const job = jobStore.get("job1")!;
    expect(job.status).toBe("processing");
    expect(job.progress).toBe(25);
  });

  it("updates momentsFound and estimatedSecondsRemaining", async () => {
    await callbackPOST(
      makeRequest(
        { status: "processing", progress: 50, momentsFound: 3, estimatedSecondsRemaining: 120 },
        authHeader()
      ),
      makeContext("job1")
    );
    const job = jobStore.get("job1")!;
    expect(job.momentsFound).toBe(3);
    expect(job.estimatedSecondsRemaining).toBe(120);
  });

  it("applies partial updates — unspecified fields retain their previous value", async () => {
    jobStore.set("job1", { ...baseJob, status: "processing", progress: 40, momentsFound: 2 });
    await callbackPOST(
      makeRequest({ progress: 60 }, authHeader()),
      makeContext("job1")
    );
    const job = jobStore.get("job1")!;
    expect(job.progress).toBe(60);
    expect(job.momentsFound).toBe(2); // unchanged
    expect(job.status).toBe("processing"); // unchanged
  });
});

// ─── Terminal states ──────────────────────────────────────────────────────────

describe("terminal states", () => {
  it("marks job as complete with progress 100", async () => {
    await callbackPOST(
      makeRequest({ status: "complete", progress: 100, momentsFound: 7 }, authHeader()),
      makeContext("job1")
    );
    const job = jobStore.get("job1")!;
    expect(job.status).toBe("complete");
    expect(job.progress).toBe(100);
    expect(job.momentsFound).toBe(7);
  });

  it("marks job as error with errorCode and errorMessage", async () => {
    await callbackPOST(
      makeRequest(
        {
          status: "error",
          errorCode: "UNSUPPORTED_CODEC",
          errorMessage: "H.265 (HEVC) is not supported; please re-encode to H.264.",
        },
        authHeader()
      ),
      makeContext("job1")
    );
    const job = jobStore.get("job1")!;
    expect(job.status).toBe("error");
    expect(job.errorCode).toBe("UNSUPPORTED_CODEC");
    expect(job.errorMessage).toContain("H.265");
  });

  it("surfaces all documented AI error codes", async () => {
    const codes = [
      "UNSUPPORTED_CODEC",
      "VIDEO_TOO_SHORT",
      "VIDEO_TOO_LONG",
      "PROCESSING_TIMEOUT",
      "INTERNAL_ERROR",
    ] as const;

    for (const errorCode of codes) {
      jobStore.set("job1", { ...baseJob });
      const res = await callbackPOST(
        makeRequest({ status: "error", errorCode }, authHeader()),
        makeContext("job1")
      );
      expect(res.status).toBe(200);
      expect(jobStore.get("job1")?.errorCode).toBe(errorCode);
    }
  });

  it("ignores updates after the job reaches complete state", async () => {
    jobStore.set("job1", { ...baseJob, status: "complete", progress: 100, momentsFound: 5 });
    const res = await callbackPOST(
      makeRequest({ status: "processing", progress: 10 }, authHeader()),
      makeContext("job1")
    );
    expect(res.status).toBe(200);
    // Store must be unchanged
    const job = jobStore.get("job1")!;
    expect(job.status).toBe("complete");
    expect(job.progress).toBe(100);
  });

  it("ignores updates after the job reaches error state", async () => {
    jobStore.set("job1", {
      ...baseJob,
      status: "error",
      errorCode: "PROCESSING_TIMEOUT",
    });
    await callbackPOST(
      makeRequest({ status: "processing", progress: 50 }, authHeader()),
      makeContext("job1")
    );
    expect(jobStore.get("job1")?.status).toBe("error");
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe("input validation", () => {
  it("returns 422 when status=error is sent without errorCode", async () => {
    const res = await callbackPOST(
      makeRequest({ status: "error", errorMessage: "something broke" }, authHeader()),
      makeContext("job1")
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when progress is out of range", async () => {
    const res = await callbackPOST(
      makeRequest({ progress: 150 }, authHeader()),
      makeContext("job1")
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 for an unknown errorCode", async () => {
    const res = await callbackPOST(
      makeRequest({ status: "error", errorCode: "MADE_UP_CODE" }, authHeader()),
      makeContext("job1")
    );
    expect(res.status).toBe(422);
  });

  it("returns 400 for missing Content-Type header", async () => {
    const req = new NextRequest("http://localhost/api/jobs/job1/callback", {
      method: "POST",
      headers: { Authorization: `Bearer ${CALLBACK_SECRET}` },
      body: JSON.stringify({ status: "processing" }),
    });
    const res = await callbackPOST(req, makeContext("job1"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Content-Type must be application/json" });
  });

  it("returns 400 for incorrect Content-Type header", async () => {
    const req = new NextRequest("http://localhost/api/jobs/job1/callback", {
      method: "POST",
      headers: { "Content-Type": "text/plain", Authorization: `Bearer ${CALLBACK_SECRET}` },
      body: "not json",
    });
    const res = await callbackPOST(req, makeContext("job1"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Content-Type must be application/json" });
  });

  it("returns 400 for malformed JSON payload", async () => {
    const req = new NextRequest("http://localhost/api/jobs/job1/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${CALLBACK_SECRET}` },
      body: "{\"status\": \"processing\", \"progress\": 10",
    });
    const res = await callbackPOST(req, makeContext("job1"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid or malformed JSON payload" });
  });
});
