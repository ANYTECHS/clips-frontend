import {
  cacheGetFresh,
  createRequestKey,
  getDedupMetrics,
  getJson,
  getPendingMutations,
  mutate,
  setOnline,
  syncQueuedMutations,
} from "@/app/lib/data-layer";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as Response;
}

describe("data-layer integration (#910 + #913 + #911)", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
    setOnline(true);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("serves a request from cache while offline", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ resource: "dashboard" }));
    await getJson({ url: "/api/dashboard", tags: ["dashboard"] });
    setOnline(false);
    const result = await getJson({ url: "/api/dashboard", tags: ["dashboard"] });
    expect(result.fromCache).toBe(true);
    expect(result.data).toEqual({ resource: "dashboard" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares one network call across two concurrent consumers", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const a = getJson({ url: "/api/dashboard", tags: ["dashboard"] });
    const b = getJson({ url: "/api/dashboard", tags: ["dashboard"] });
    resolveFetch?.(jsonResponse({ shared: true }));
    const [ra, rb] = await Promise.all([a, b]);

    expect(ra.data).toEqual(rb.data);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getDedupMetrics().deduplicatedCount).toBeGreaterThanOrEqual(1);
  });

  it("queues an offline mutation, syncs on reconnect, invalidates, and refreshes without duplicates", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ clips: [] }));
    await getJson({ url: "/api/clips", tags: ["clips"] });
    const key = createRequestKey({ url: "/api/clips" });
    expect(cacheGetFresh(key)).toEqual({ clips: [] });

    setOnline(false);
    const queued = await mutate({
      method: "POST",
      url: "/clips/post",
      body: { clipIds: ["c1"] },
      invalidateTags: ["clips"],
      queueWhenOffline: true,
      idempotencyKey: "clips.post|user1",
    });
    expect(queued.queued).toBe(true);
    expect(getPendingMutations()).toHaveLength(1);

    const duplicate = await mutate({
      method: "POST",
      url: "/clips/post",
      body: { clipIds: ["c1"] },
      invalidateTags: ["clips"],
      queueWhenOffline: true,
      idempotencyKey: "clips.post|user1",
    });
    expect(duplicate.queued).toBe(true);
    expect(getPendingMutations()).toHaveLength(1);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true, id: "clip-1" }))
      .mockResolvedValueOnce(jsonResponse({ clips: [{ id: "clip-1" }] }));

    setOnline(true);
    const report = await syncQueuedMutations();
    expect(report.succeeded).toBe(1);
    expect(report.attempted).toBe(1);
    expect(cacheGetFresh(key)).toBeUndefined();

    const refreshed = await getJson({ url: "/api/clips", tags: ["clips"] });
    expect(refreshed.fromCache).toBe(false);
    expect(refreshed.data).toEqual({ clips: [{ id: "clip-1" }] });

    await syncQueuedMutations();
    const postCalls = fetchMock.mock.calls.filter(
      (call) => (call[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(postCalls).toHaveLength(1);
  });
});
