/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET as searchGET } from "@/app/api/search/route";
import { clipsStore } from "@/app/api/clips/clipsStore";
import { earningsStore } from "@/app/api/earnings/earningsStore";

jest.mock("next-auth", () => ({ default: jest.fn(), getServerSession: jest.fn() }));
import { getServerSession } from "next-auth";
const mockGetServerSession = getServerSession as jest.Mock;

function req(query: string) {
  return new NextRequest(`http://localhost/api/search${query}`);
}

describe("GET /api/search (issue #798)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await searchGET(req("?q=clip"));
    expect(res.status).toBe(401);
  });

  it("returns empty groups for a blank query", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "search-user-empty-q" } });
    const res = await searchGET(req(""));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual({ clips: [], projects: [], earnings: [] });
  });

  it("finds a clip by (case-insensitive, partial) title", async () => {
    const userId = "search-user-clips";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });
    // Seed this user's clip pool.
    clipsStore.getClipsForUser(userId);

    const res = await searchGET(req("?q=big+reveal&types=clips"));
    const json = await res.json();

    expect(json.data.clips).toHaveLength(1);
    expect(json.data.clips[0]).toMatchObject({
      type: "clip",
      title: expect.stringContaining("The Big Reveal Hook"),
      href: "/projects",
    });
    expect(json.data.projects).toEqual([]);
    expect(json.data.earnings).toEqual([]);
  });

  it("finds an earnings transaction by description", async () => {
    const userId = "search-user-earnings";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });
    earningsStore.setTransactions(userId, [
      {
        id: "TX-1",
        date: "2026-01-01",
        description: "YouTube payout #1",
        amount: 42,
        platform: "YouTube",
        type: "payout",
        status: "completed",
        taxId: "TAX-1",
      },
    ]);

    const res = await searchGET(req("?q=youtube+payout&types=earnings"));
    const json = await res.json();

    expect(json.data.earnings).toHaveLength(1);
    expect(json.data.earnings[0]).toMatchObject({
      type: "earning",
      id: "TX-1",
      title: "YouTube payout #1",
      href: "/earnings",
    });
  });

  it("only searches the types requested via the types param", async () => {
    const userId = "search-user-types-filter";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });
    clipsStore.getClipsForUser(userId);
    earningsStore.setTransactions(userId, [
      {
        id: "TX-2",
        date: "2026-01-01",
        description: "Reveal payout",
        amount: 10,
        platform: "YouTube",
        type: "payout",
        status: "completed",
        taxId: "TAX-2",
      },
    ]);

    const res = await searchGET(req("?q=reveal&types=clips"));
    const json = await res.json();

    expect(json.data.clips.length).toBeGreaterThan(0);
    expect(json.data.earnings).toEqual([]);
  });

  it("caps results at 10 per type", async () => {
    const userId = "search-user-cap";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });
    earningsStore.setTransactions(
      userId,
      Array.from({ length: 15 }, (_, i) => ({
        id: `TX-cap-${i}`,
        date: "2026-01-01",
        description: `Matching transaction ${i}`,
        amount: 1,
        platform: "YouTube" as const,
        type: "payout" as const,
        status: "completed" as const,
        taxId: `TAX-cap-${i}`,
      })),
    );

    const res = await searchGET(req("?q=matching&types=earnings"));
    const json = await res.json();

    expect(json.data.earnings).toHaveLength(10);
  });

  it("returns no results for a query that matches nothing", async () => {
    const userId = "search-user-no-match";
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });
    clipsStore.getClipsForUser(userId);

    const res = await searchGET(req("?q=zzz_no_such_thing_zzz"));
    const json = await res.json();

    expect(json.data).toEqual({ clips: [], projects: [], earnings: [] });
  });

  it("scopes results to the authenticated user only", async () => {
    const userA = "search-user-a";
    const userB = "search-user-b";
    earningsStore.setTransactions(userA, [
      {
        id: "TX-A",
        date: "2026-01-01",
        description: "Shared keyword A",
        amount: 5,
        platform: "YouTube",
        type: "payout",
        status: "completed",
        taxId: "TAX-A",
      },
    ]);
    earningsStore.setTransactions(userB, [
      {
        id: "TX-B",
        date: "2026-01-01",
        description: "Shared keyword B",
        amount: 5,
        platform: "YouTube",
        type: "payout",
        status: "completed",
        taxId: "TAX-B",
      },
    ]);

    mockGetServerSession.mockResolvedValue({ user: { id: userA } });
    const res = await searchGET(req("?q=shared+keyword&types=earnings"));
    const json = await res.json();

    expect(json.data.earnings).toHaveLength(1);
    expect(json.data.earnings[0].id).toBe("TX-A");
  });
});
