/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET as jobGET, POST as jobPOST } from "@/app/api/jobs/[id]/route";
import { GET as streamGET } from "@/app/api/jobs/[id]/stream/route";
import { jobStore } from "@/app/api/jobs/shared/jobStore";

jest.mock("next-auth", () => ({ default: jest.fn(), getServerSession: jest.fn() }));
import { getServerSession } from "next-auth";
const mockGetServerSession = getServerSession as jest.Mock;

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

const ownerJob = {
  id: "job1",
  userId: "user-owner",
  progress: 0,
  status: "processing" as const,
  momentsFound: 0,
  estimatedSecondsRemaining: 300,
  createdAt: Date.now(),
};

beforeEach(() => {
  jobStore.clear();
  jobStore.set("job1", ownerJob);
});

function makeRequest(url = "http://localhost/api/jobs/job1") {
  return new NextRequest(url);
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

  it("returns 200 for job owner", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-owner" } });
    const res = await jobGET(makeRequest(), makeContext("job1"));
    expect(res.status).toBe(200);
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

  it("returns 200 for job owner", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-owner" } });
    const res = await jobPOST(makeRequest(), makeContext("job1"));
    expect(res.status).toBe(200);
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
});
