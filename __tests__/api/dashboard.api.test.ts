/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET as dashboardGET } from "@/app/api/dashboard/route";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { earningsStore } from "@/app/api/earnings/earningsStore";

jest.mock("next-auth", () => ({ default: jest.fn(), getServerSession: jest.fn() }));
import { getServerSession } from "next-auth";
const mockGetServerSession = getServerSession as jest.Mock;

describe("GET /api/dashboard", () => {
  beforeEach(async () => {
    await jobStore.clear();
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/dashboard");
    const res = await dashboardGET(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns aggregated zero-state metrics for a new user with no jobs", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "new-user-123" } });
    earningsStore.setTransactions("new-user-123", []);

    const req = new NextRequest("http://localhost/api/dashboard");
    const res = await dashboardGET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data).toBeDefined();

    const { stats, revenueTrend, recentProjects } = json.data;
    expect(stats.earnings.total).toBe("$0.00");
    expect(stats.clips.total).toBe(0);
    expect(stats.platforms.total).toBe(0);
    expect(revenueTrend).toEqual([]);
    expect(recentProjects).toEqual([]);
  });

  it("returns aggregated stats, revenue trend, and recent projects for user with data", async () => {
    const userId = "test-user-dash";
    mockGetServerSession.mockResolvedValue({ user: { id: userId, provider: "youtube" } });

    earningsStore.setTransactions(userId, [
      {
        id: "tx-1",
        date: "2026-07-20",
        description: "YouTube payout #1",
        amount: 250.0,
        platform: "YouTube",
        type: "payout",
        status: "completed",
      },
      {
        id: "tx-2",
        date: "2026-07-22",
        description: "TikTok royalty #2",
        amount: 150.0,
        platform: "TikTok",
        type: "royalty",
        status: "completed",
      },
    ]);

    await jobStore.set("job-101", {
      id: "job-101",
      userId,
      status: "complete",
      progress: 100,
      momentsFound: 4,
      estimatedSecondsRemaining: 0,
      createdAt: Date.now() - 1000,
      filename: "highlight_reel.mp4",
    } as any);

    const req = new NextRequest("http://localhost/api/dashboard");
    const res = await dashboardGET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.error).toBeNull();

    const { stats, revenueTrend, recentProjects } = json.data;
    expect(stats.earnings.total).toBe("$400.00");
    expect(stats.clips.total).toBe(4);
    expect(stats.platforms.total).toBeGreaterThanOrEqual(2);

    expect(revenueTrend).toHaveLength(2);
    expect(recentProjects).toHaveLength(1);
    expect(recentProjects[0].id).toBe("job-101");
    expect(recentProjects[0].title).toBe("highlight_reel");
    expect(recentProjects[0].clipsGenerated).toBe(4);
    expect(recentProjects[0].status).toBe("completed");
  });
});
