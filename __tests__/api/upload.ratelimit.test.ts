/**
 * @jest-environment node
 *
 * Integration tests for issue #499:
 *  - /api/upload: cap files.length at MAX_FILES_PER_REQUEST (10)
 *  - /api/jobs/[id]: validate id format
 *  - Server-side rate limiting (applyRateLimit)
 */

import { NextRequest } from "next/server";

jest.mock("next-auth", () => ({ default: jest.fn(), getServerSession: jest.fn() }));
jest.mock("@/app/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/app/lib/cloudStorage", () => ({
  uploadToQuarantine: jest.fn().mockResolvedValue({
    jobId: "job-test-001",
    filename: "video.mp4",
    quarantineKey: "uploads/quarantine/video.mp4",
  }),
  moveFromQuarantine: jest.fn().mockResolvedValue({
    jobId: "job-test-001",
    filename: "video.mp4",
    objectKey: "uploads/video.mp4",
    url: "https://cdn.example.com/video.mp4",
  }),
  deleteFile: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/app/lib/virusScan", () => ({
  scanFile: jest.fn().mockResolvedValue({ isClean: true, provider: "mock" }),
  getScanConfig: jest.fn().mockReturnValue({ enabled: true, provider: "mock" }),
  VirusScanError: class VirusScanError extends Error {},
}));
jest.mock("@/app/lib/aiBackend", () => ({
  dispatchJob: jest.fn().mockResolvedValue({ dispatched: true }),
}));

import { getServerSession } from "next-auth";
const mockGetServerSession = getServerSession as jest.Mock;

const APP_ORIGIN = "http://localhost:3000";

function makeVideoFile(name = "video.mp4") {
  return new File([new Uint8Array(1024)], name, { type: "video/mp4" });
}

function makeUploadRequest(files: File[]) {
  const formData = new FormData();
  for (const f of files) formData.append("files", f);
  return new NextRequest(`${APP_ORIGIN}/api/upload`, {
    method: "POST",
    body: formData,
    headers: { origin: APP_ORIGIN },
  });
}

// ── /api/upload — file count cap ──────────────────────────────────────────────

describe("POST /api/upload — file count cap", () => {
  const { __resetRateLimitStore } = require("@/app/lib/serverRateLimit");
  const { jobStore } = require("@/app/api/jobs/shared/jobStore");

  beforeEach(() => {
    process.env.NEXTAUTH_URL = APP_ORIGIN;
    jobStore.clear();
    __resetRateLimitStore();
    mockGetServerSession.mockResolvedValue({ user: { id: "user-cap" } });
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it("rejects 11 files with 400 and descriptive error", async () => {
    const { POST } = require("@/app/api/upload/route");
    const files = Array.from({ length: 11 }, (_, i) => makeVideoFile(`v${i}.mp4`));
    const res = await POST(makeUploadRequest(files));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Too many files/i);
    expect(body.error).toMatch(/10/);
  });

  it("rejects 100 files with 400", async () => {
    const { POST } = require("@/app/api/upload/route");
    const files = Array.from({ length: 100 }, (_, i) => makeVideoFile(`v${i}.mp4`));
    const res = await POST(makeUploadRequest(files));
    expect(res.status).toBe(400);
  });
});

// ── /api/jobs/[id] — job id format validation ─────────────────────────────────

describe("GET /api/jobs/[id] — job id format validation", () => {
  const { __resetRateLimitStore } = require("@/app/lib/serverRateLimit");

  beforeEach(() => {
    __resetRateLimitStore();
    mockGetServerSession.mockResolvedValue({ user: { id: "user-jobs" } });
  });

  async function callGet(id: string) {
    const { GET } = require("@/app/api/jobs/[id]/route");
    const req = new NextRequest(`${APP_ORIGIN}/api/jobs/${id}`, {
      headers: { origin: APP_ORIGIN },
    });
    return GET(req, { params: Promise.resolve({ id }) });
  }

  it("accepts a valid alphanumeric job id (returns 404 not 400)", async () => {
    const res = await callGet("job_1234567890_abc123xyz");
    expect(res.status).toBe(404);
  });

  it("accepts a UUID-style id (returns 404 not 400)", async () => {
    const res = await callGet("550e8400-e29b-41d4-a716-446655440000");
    expect(res.status).toBe(404);
  });

  it("rejects path-traversal characters", async () => {
    const res = await callGet("../../etc/passwd");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid job id/i);
  });

  it("rejects SQL injection characters", async () => {
    const res = await callGet("1' OR '1'='1");
    expect(res.status).toBe(400);
  });

  it("rejects an id longer than 64 characters", async () => {
    const res = await callGet("a".repeat(65));
    expect(res.status).toBe(400);
  });

  it("accepts exactly 64-char id (boundary, returns 404)", async () => {
    const res = await callGet("a".repeat(64));
    expect(res.status).toBe(404);
  });
});

// ── Server-side rate limiting ─────────────────────────────────────────────────

describe("applyRateLimit — serverRateLimit", () => {
  const {
    applyRateLimit,
    getRateLimitHeaders,
    __resetRateLimitStore,
  } = require("@/app/lib/serverRateLimit");

  function makeReq(ip = "1.2.3.4") {
    return new NextRequest(`${APP_ORIGIN}/api/test`, {
      headers: { "x-forwarded-for": ip },
    });
  }

  beforeEach(() => __resetRateLimitStore());

  it("returns null when under the limit", () => {
    expect(applyRateLimit(makeReq(), { limit: 5, windowMs: 60_000 })).toBeNull();
  });

  it("returns 429 when limit exceeded", () => {
    const req = makeReq("2.3.4.5");
    const opts = { limit: 2, windowMs: 60_000 };
    applyRateLimit(req, opts);
    applyRateLimit(req, opts);
    const res = applyRateLimit(req, opts);
    expect(res?.status).toBe(429);
  });

  it("sets X-RateLimit-Limit header on 429", () => {
    const req = makeReq("3.4.5.6");
    const opts = { limit: 1, windowMs: 60_000 };
    applyRateLimit(req, opts);
    const res = applyRateLimit(req, opts);
    expect(res?.headers.get("X-RateLimit-Limit")).toBe("1");
  });

  it("sets X-RateLimit-Remaining: 0 on 429", () => {
    const req = makeReq("4.5.6.7");
    const opts = { limit: 1, windowMs: 60_000 };
    applyRateLimit(req, opts);
    const res = applyRateLimit(req, opts);
    expect(res?.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("sets Retry-After header on 429", () => {
    const req = makeReq("5.6.7.8");
    const opts = { limit: 1, windowMs: 60_000 };
    applyRateLimit(req, opts);
    const res = applyRateLimit(req, opts);
    const retryAfter = Number(res?.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it("uses separate buckets per IP", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    applyRateLimit(makeReq("10.0.0.1"), opts);
    applyRateLimit(makeReq("10.0.0.1"), opts); // 429 for .1
    expect(applyRateLimit(makeReq("10.0.0.2"), opts)).toBeNull(); // .2 unaffected
  });

  it("resets bucket after window elapses", () => {
    jest.useFakeTimers();
    const req = makeReq("6.7.8.9");
    const opts = { limit: 1, windowMs: 1000 };
    applyRateLimit(req, opts);
    applyRateLimit(req, opts); // 429
    jest.advanceTimersByTime(1001);
    expect(applyRateLimit(req, opts)).toBeNull(); // window reset
    jest.useRealTimers();
  });

  it("getRateLimitHeaders returns correct remaining count", () => {
    const req = makeReq("7.8.9.10");
    const opts = { limit: 10, windowMs: 60_000 };
    applyRateLimit(req, opts); // count = 1
    applyRateLimit(req, opts); // count = 2
    const h = getRateLimitHeaders(req, opts);
    expect(h["X-RateLimit-Limit"]).toBe("10");
    expect(h["X-RateLimit-Remaining"]).toBe("8");
  });
});
