/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET as jobGET, POST as jobPOST } from "@/app/api/jobs/[id]/route";
import { GET as streamGET } from "@/app/api/jobs/[id]/stream/route";
import { jobStore } from "@/app/api/jobs/shared/jobStore";

jest.mock("next-auth", () => ({ default: jest.fn(), getServerSession: jest.fn() }));
jest.mock("@/app/lib/aiBackend", () => ({
  dispatchJob: jest.fn().mockResolvedValue({ dispatched: true }),
}));

import { getServerSession } from "next-auth";
const mockGetServerSession = getServerSession as jest.Mock;

const APP_ORIGIN = "http://localhost:3000";
const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

const ownerJob = {
  id: "job1",
  userId: "user-owner",
  status: "processing" as const,
  progress: 42,
  momentsFound: 3,
  estimatedSecondsRemaining: 180,
  createdAt: Date.now(),
};

beforeEach(async () => {
  process.env.NEXTAUTH_URL = APP_ORIGIN;
  await jobStore.clear();
  await jobStore.set("job1", ownerJob);
});

function makeRequest(url = "http://localhost/api/jobs/job1") {
  return new NextRequest(url, { headers: { origin: APP_ORIGIN } });
}

describe("GET /api/jobs/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await jobGET(makeRequest(), makeContext("job1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user does not own the job", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "other-user" } });
    const res = await jobGET(makeRequest(), makeContext("job1"));
    expect(res.status).toBe(403);
  });

  it("returns real status from the store (no simulation)", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-owner" } });
    const res = await jobGET(makeRequest(), makeContext("job1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Must reflect exactly what was put in the store — no fake progress drift
    expect(body.progress).toBe(42);
    expect(body.momentsFound).toBe(3);
    expect(body.status).toBe("processing");
  });

  it("includes errorCode and errorMessage when job is in error state", async () => {
    await jobStore.set("job1", {
      ...ownerJob,
      status: "error",
      errorCode: "UNSUPPORTED_CODEC",
      errorMessage: "H.265 not supported",
    });
    mockGetServerSession.mockResolvedValue({ user: { id: "user-owner" } });
    const res = await jobGET(makeRequest(), makeContext("job1"));
    const body = await res.json();
    expect(body.errorCode).toBe("UNSUPPORTED_CODEC");
    expect(body.errorMessage).toBe("H.265 not supported");
  });
});

describe("POST /api/jobs/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await jobPOST(makeRequest(), makeContext("job1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user does not own the job", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "other-user" } });
    const res = await jobPOST(makeRequest(), makeContext("job1"));
    expect(res.status).toBe(403);
  });

  it("resets job to queued state on restart", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-owner" } });
    const res = await jobPOST(makeRequest(), makeContext("job1"));
    expect(res.status).toBe(200);
    const job = await jobStore.get("job1")!;
    expect(job.status).toBe("queued");
    expect(job.progress).toBe(0);
    expect(job.momentsFound).toBe(0);
  });

  it("clears errorCode and errorMessage on restart", async () => {
    await jobStore.set("job1", {
      ...ownerJob,
      status: "error",
      errorCode: "PROCESSING_TIMEOUT",
      errorMessage: "Timed out after 300 s",
    });
    mockGetServerSession.mockResolvedValue({ user: { id: "user-owner" } });
    await jobPOST(makeRequest(), makeContext("job1"));
    const job = await jobStore.get("job1")!;
    expect(job.errorCode).toBeUndefined();
    expect(job.errorMessage).toBeUndefined();
  });
});

describe("GET /api/jobs/[id]/stream", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await streamGET(makeRequest(), makeContext("job1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user does not own the job", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "other-user" } });
    const res = await streamGET(makeRequest(), makeContext("job1"));
    expect(res.status).toBe(403);
  });

  it("returns 200 SSE stream for job owner", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-owner" } });
    const res = await streamGET(makeRequest(), makeContext("job1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("initial SSE event reflects real store values", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-owner" } });
    const res = await streamGET(makeRequest(), makeContext("job1"));
    // Read the first SSE event from the stream
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    reader.cancel();

    expect(text).toContain("data:");
    const json = JSON.parse(text.replace(/^data: /, "").trim());
    expect(json.progress).toBe(42);
    expect(json.momentsFound).toBe(3);
    expect(json.status).toBe("processing");
  });
});
