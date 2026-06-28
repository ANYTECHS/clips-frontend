/**
 * @jest-environment node
 *
 * CSRF integration tests for POST /api/jobs/[id] (job restart).
 */
import { NextRequest } from "next/server";
import { POST as jobPOST } from "@/app/api/jobs/[id]/route";
import { jobStore } from "@/app/api/jobs/shared/jobStore";

import { JOB_ESTIMATED_SECONDS } from "@/app/lib/constants";

jest.mock("next-auth", () => ({ default: jest.fn(), getServerSession: jest.fn() }));
jest.mock("@/app/lib/aiBackend", () => ({
  dispatchJob: jest.fn().mockResolvedValue({ dispatched: true }),
}));
import { getServerSession } from "next-auth";
const mockGetServerSession = getServerSession as jest.Mock;

const APP_ORIGIN = "https://app.example.com";
const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

const ownerJob = {
  id: "job1",
  userId: "user-owner",
  progress: 0,
  status: "processing" as const,
  momentsFound: 0,
  estimatedSecondsRemaining: JOB_ESTIMATED_SECONDS,
  createdAt: Date.now(),
};

beforeEach(() => {
  process.env.NEXTAUTH_URL = APP_ORIGIN;
  jobStore.clear();
  jobStore.set("job1", ownerJob);
  mockGetServerSession.mockResolvedValue({ user: { id: "user-owner" } });
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/jobs/job1", {
    method: "POST",
    headers,
  });
}

describe("POST /api/jobs/[id] — CSRF protection", () => {
  it("allows same-origin requests (matching Origin header)", async () => {
    const res = await jobPOST(
      makeRequest({ origin: APP_ORIGIN }),
      makeContext("job1")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("allows same-origin requests identified via Referer header", async () => {
    const res = await jobPOST(
      makeRequest({ referer: `${APP_ORIGIN}/dashboard` }),
      makeContext("job1")
    );
    expect(res.status).toBe(200);
  });

  it("blocks cross-origin requests with 403", async () => {
    const res = await jobPOST(
      makeRequest({ origin: "https://evil.com" }),
      makeContext("job1")
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "Forbidden" });
  });

  it("blocks requests with no Origin or Referer header", async () => {
    const res = await jobPOST(makeRequest(), makeContext("job1"));
    expect(res.status).toBe(403);
  });

  it("CSRF check runs before auth check — cross-origin unauthenticated request returns 403 not 401", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await jobPOST(
      makeRequest({ origin: "https://evil.com" }),
      makeContext("job1")
    );
    // Should be rejected at CSRF layer, not reach auth layer
    expect(res.status).toBe(403);
  });
});
