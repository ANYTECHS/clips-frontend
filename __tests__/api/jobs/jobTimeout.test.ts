/**
 * @jest-environment node
 *
 * Job timeout sweep and retry flow — Issue #1216.
 */
import { NextRequest } from "next/server";
import { jobStore, type Job } from "@/app/api/jobs/shared/jobStore";
import {
  JOB_TIMEOUT_REASON,
  createRetryJob,
  getJobTimeoutMs,
  isJobTimedOut,
  sweepTimedOutJobs,
} from "@/app/api/jobs/shared/jobTimeout";
import { GET as cronGET } from "@/app/api/cron/route";
import { POST as retryPOST } from "@/app/api/jobs/[id]/retry/route";
import { sendNotification } from "@/app/lib/notifications";
import { dispatchJob } from "@/app/lib/aiBackend";

jest.mock("@/app/lib/notifications", () => ({
  sendNotification: jest.fn().mockResolvedValue({}),
}));

jest.mock("@/app/lib/aiBackend", () => ({
  dispatchJob: jest.fn().mockResolvedValue({ dispatched: true }),
}));

jest.mock("@/app/lib/csrf", () => ({
  checkCsrf: jest.fn(() => null),
}));

jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: "user-owner" } }),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const MINUTE = 60 * 1000;
const TIMEOUT_MS = 30 * MINUTE;

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job1",
    userId: "user-owner",
    status: "processing",
    progress: 40,
    momentsFound: 0,
    estimatedSecondsRemaining: 60,
    createdAt: Date.now(),
    objectKey: "uploads/user-owner/video.mp4",
    contentType: "video/mp4",
    filename: "video.mp4",
    ...overrides,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  delete process.env.JOB_TIMEOUT_MINUTES;
  delete process.env.CRON_SECRET;
  await jobStore.clear();
});

describe("timeout detection", () => {
  it("defaults JOB_TIMEOUT_MINUTES to 30", () => {
    expect(getJobTimeoutMs()).toBe(TIMEOUT_MS);
  });

  it("honours JOB_TIMEOUT_MINUTES", () => {
    process.env.JOB_TIMEOUT_MINUTES = "5";
    expect(getJobTimeoutMs()).toBe(5 * MINUTE);
  });

  it("flags processing jobs older than the timeout", () => {
    const now = Date.now();
    const job = makeJob({ processingStartedAt: now - TIMEOUT_MS - 1 });
    expect(isJobTimedOut(job, now, TIMEOUT_MS)).toBe(true);
  });

  it("ignores processing jobs within the timeout", () => {
    const now = Date.now();
    const job = makeJob({ processingStartedAt: now - TIMEOUT_MS + MINUTE });
    expect(isJobTimedOut(job, now, TIMEOUT_MS)).toBe(false);
  });

  it("ignores jobs that are not processing", () => {
    const now = Date.now();
    for (const status of ["queued", "complete", "error"] as const) {
      const job = makeJob({ status, createdAt: now - 10 * TIMEOUT_MS });
      expect(isJobTimedOut(job, now, TIMEOUT_MS)).toBe(false);
    }
  });

  it("falls back to createdAt when processingStartedAt is missing", () => {
    const now = Date.now();
    const job = makeJob({ createdAt: now - TIMEOUT_MS - 1 });
    expect(isJobTimedOut(job, now, TIMEOUT_MS)).toBe(true);
  });
});

describe("failure marking", () => {
  it("marks stale jobs failed with the timeout reason and notifies the owner", async () => {
    const now = Date.now();
    await jobStore.set("stale", makeJob({ id: "stale", processingStartedAt: now - 2 * TIMEOUT_MS }));
    await jobStore.set("fresh", makeJob({ id: "fresh", processingStartedAt: now }));

    const result = await sweepTimedOutJobs(now, TIMEOUT_MS);

    expect(result.timedOut).toEqual(["stale"]);
    const stale = await jobStore.get("stale");
    expect(stale?.status).toBe("error");
    expect(stale?.errorCode).toBe("PROCESSING_TIMEOUT");
    expect(stale?.errorMessage).toBe(JOB_TIMEOUT_REASON);
    expect((await jobStore.get("fresh"))?.status).toBe("processing");

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification).toHaveBeenCalledWith("user-owner", "job_failed", {
      jobId: "stale",
      reason: JOB_TIMEOUT_REASON,
    });
  });

  it("still marks the job failed when the notification fails", async () => {
    (sendNotification as jest.Mock).mockRejectedValueOnce(new Error("db down"));
    const now = Date.now();
    await jobStore.set("stale", makeJob({ id: "stale", processingStartedAt: now - 2 * TIMEOUT_MS }));

    const result = await sweepTimedOutJobs(now, TIMEOUT_MS);

    expect(result.notified).toBe(0);
    expect((await jobStore.get("stale"))?.status).toBe("error");
  });
});

describe("GET /api/cron", () => {
  function cronRequest(headers: Record<string, string> = {}) {
    return new NextRequest("http://localhost/api/cron", { headers });
  }

  it("rejects requests without the CRON_SECRET bearer token", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const res = await cronGET(cronRequest({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  it("runs the timeout sweep when authorized", async () => {
    process.env.CRON_SECRET = "cron-secret";
    await jobStore.set(
      "stale",
      makeJob({ id: "stale", processingStartedAt: Date.now() - 2 * TIMEOUT_MS }),
    );

    const res = await cronGET(cronRequest({ authorization: "Bearer cron-secret" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.timedOut).toBe(1);
    expect((await jobStore.get("stale"))?.status).toBe("error");
  });
});

describe("retry flow", () => {
  it("creates a new queued job reusing the failed job's source video", async () => {
    const failed = makeJob({ status: "error", errorCode: "PROCESSING_TIMEOUT" });
    const retry = await createRetryJob(failed);

    expect(retry.id).not.toBe(failed.id);
    expect(retry.status).toBe("queued");
    expect(retry.objectKey).toBe(failed.objectKey);
    expect(retry.retriedFrom).toBe(failed.id);
    expect(await jobStore.get(retry.id)).toEqual(retry);
  });

  it("refuses to retry jobs that have not failed", async () => {
    await expect(createRetryJob(makeJob({ status: "processing" }))).rejects.toMatchObject({
      status: 409,
    });
  });

  it("POST /api/jobs/[id]/retry re-dispatches without a re-upload", async () => {
    await jobStore.set("job1", makeJob({ status: "error", errorCode: "PROCESSING_TIMEOUT" }));

    const res = await retryPOST(
      new NextRequest("http://localhost/api/jobs/job1/retry", { method: "POST" }),
      { params: Promise.resolve({ id: "job1" }) },
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.retriedFrom).toBe("job1");
    expect(dispatchJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: body.data.jobId,
        objectKey: "uploads/user-owner/video.mp4",
      }),
    );
  });

  it("POST /api/jobs/[id]/retry returns 409 for a job that is still processing", async () => {
    await jobStore.set("job1", makeJob());

    const res = await retryPOST(
      new NextRequest("http://localhost/api/jobs/job1/retry", { method: "POST" }),
      { params: Promise.resolve({ id: "job1" }) },
    );

    expect(res.status).toBe(409);
    expect(dispatchJob).not.toHaveBeenCalled();
  });
});
