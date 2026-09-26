import {
  cacheGetFresh,
  cacheSet,
  configureDataLayer,
  createRequestKey,
  getJson,
  invalidateAfterMutation,
  invalidateAll,
  invalidateKey,
  invalidatePrefix,
  invalidateStale,
  invalidateTag,
  mutate,
  setOnline,
  subscribeInvalidation,
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

describe("cache invalidation", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
    setOnline(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it("invalidates related cached data after a successful mutation", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ clips: [1] }))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ clips: [1, 2] }));

    await getJson({ url: "/api/clips", tags: ["clips"] });
    expect(cacheGetFresh(createRequestKey({ url: "/api/clips" }))).toEqual({ clips: [1] });

    await mutate({
      method: "POST",
      url: "/clips/post",
      body: { clipIds: ["c1"] },
      invalidateTags: ["clips"],
    });

    expect(cacheGetFresh(createRequestKey({ url: "/api/clips" }))).toBeUndefined();

    const refreshed = await getJson({ url: "/api/clips", tags: ["clips"] });
    expect(refreshed.data).toEqual({ clips: [1, 2] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("leaves unrelated cached data intact", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ clips: true }))
      .mockResolvedValueOnce(jsonResponse({ earnings: true }))
      .mockResolvedValueOnce(jsonResponse({ success: true }));

    await getJson({ url: "/api/clips", tags: ["clips"] });
    await getJson({ url: "/api/earnings", tags: ["earnings"] });

    await mutate({
      method: "POST",
      url: "/clips/post",
      body: { clipIds: ["c1"] },
      invalidateTags: ["clips"],
    });

    expect(cacheGetFresh(createRequestKey({ url: "/api/clips" }))).toBeUndefined();
    expect(cacheGetFresh(createRequestKey({ url: "/api/earnings" }))).toEqual({ earnings: true });
  });

  it("supports time-based invalidation", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    configureDataLayer({ cacheTtlMs: 100, staleTtlMs: 1_000 });

    cacheSet("GET:/api/dashboard", { n: 1 }, { tags: ["dashboard"] });
    expect(cacheGetFresh("GET:/api/dashboard")).toEqual({ n: 1 });

    jest.setSystemTime(new Date("2026-01-01T00:00:00.101Z"));
    const removed = invalidateStale();
    expect(removed).toContain("GET:/api/dashboard");
    expect(cacheGetFresh("GET:/api/dashboard")).toBeUndefined();
  });

  it("supports manual key invalidation", () => {
    cacheSet("GET:/api/dashboard", { n: 1 });
    invalidateKey("GET:/api/dashboard");
    expect(cacheGetFresh("GET:/api/dashboard")).toBeUndefined();
  });

  it("supports grouped prefix invalidation", () => {
    cacheSet("GET:/api/dashboard", { all: true });
    cacheSet("GET:/api/dashboard?range=7d", { week: true });
    cacheSet("GET:/api/earnings", { earnings: true });

    invalidatePrefix("GET:/api/dashboard");

    expect(cacheGetFresh("GET:/api/dashboard")).toBeUndefined();
    expect(cacheGetFresh("GET:/api/dashboard?range=7d")).toBeUndefined();
    expect(cacheGetFresh("GET:/api/earnings")).toEqual({ earnings: true });
  });

  it("supports global invalidation", () => {
    cacheSet("GET:/api/dashboard", { n: 1 });
    invalidateAll();
    expect(cacheGetFresh("GET:/api/dashboard")).toBeUndefined();
  });

  it("notifies subscribers so callers can refetch once", () => {
    const keys: string[][] = [];
    const stop = subscribeInvalidation((changed) => keys.push(changed));

    invalidateAfterMutation({ tags: ["dashboard"], keys: ["GET:/api/dashboard"] });
    stop();

    expect(keys.some((batch) => batch.includes("GET:/api/dashboard"))).toBe(true);
  });

  it("does not create duplicate network calls when many callers refetch after invalidation", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ n: 1 }));
    await getJson({ url: "/api/dashboard", tags: ["dashboard"] });
    invalidateTag("dashboard");

    let resolveFetch: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const a = getJson({ url: "/api/dashboard", tags: ["dashboard"] });
    const b = getJson({ url: "/api/dashboard", tags: ["dashboard"] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    resolveFetch?.(jsonResponse({ n: 2 }));
    await Promise.all([a, b]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("invalidates affected cache after offline synchronization", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ clips: [] }));
    await getJson({ url: "/api/clips", tags: ["clips"] });
    expect(cacheGetFresh(createRequestKey({ url: "/api/clips" }))).toBeDefined();

    setOnline(false);
    await mutate({
      method: "POST",
      url: "/clips/post",
      body: { clipIds: ["c1"] },
      invalidateTags: ["clips"],
      queueWhenOffline: true,
    });

    expect(cacheGetFresh(createRequestKey({ url: "/api/clips" }))).toBeDefined();

    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    setOnline(true);
    await syncQueuedMutations();

    expect(cacheGetFresh(createRequestKey({ url: "/api/clips" }))).toBeUndefined();
  });
});
