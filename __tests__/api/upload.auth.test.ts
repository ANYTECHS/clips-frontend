/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/upload/route";
import { jobStore } from "@/app/api/jobs/shared/jobStore";

jest.mock("next-auth", () => ({ default: jest.fn(), getServerSession: jest.fn() }));
jest.mock("@/app/lib/cloudStorage", () => ({
  uploadFile: jest.fn().mockResolvedValue({
    jobId: "job-abc",
    filename: "video.mp4",
    size: 1024,
    contentType: "video/mp4",
    objectKey: "uploads/video.mp4",
    url: "https://cdn.example.com/video.mp4",
  }),
}));

import { getServerSession } from "next-auth";
const mockGetServerSession = getServerSession as jest.Mock;

function makeUploadRequest(file?: File) {
  const formData = new FormData();
  if (file) formData.append("files", file);
  return new NextRequest("http://localhost/api/upload", { method: "POST", body: formData });
}

function makeVideoFile(name = "video.mp4", size = 1024) {
  return new File([new Uint8Array(size)], name, { type: "video/mp4" });
}

beforeEach(() => {
  jobStore.clear();
  mockGetServerSession.mockReset();
});

describe("POST /api/upload", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeUploadRequest(makeVideoFile()));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when session has no user id", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@example.com" } });
    const res = await POST(makeUploadRequest(makeVideoFile()));
    expect(res.status).toBe(401);
  });

  it("returns 200 and tags job with userId for authenticated user", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-123" } });
    const res = await POST(makeUploadRequest(makeVideoFile()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.jobId).toBe("job-abc");
    expect(jobStore.get("job-abc")?.userId).toBe("user-123");
  });

  it("returns 400 when no files are provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-123" } });
    const res = await POST(makeUploadRequest());
    expect(res.status).toBe(400);
  });
});
