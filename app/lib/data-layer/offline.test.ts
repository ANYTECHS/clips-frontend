import {
  configureDataLayer,
  getJson,
  getPendingMutations,
  getQueuedMutations,
  isOnline,
  mutate,
  OfflineCacheMissError,
  QUEUE_STORAGE_KEY,
  setOnline,
  startAutomaticSync,
  startConnectivityMonitor,
  stopConnectivityMonitor,
  subscribeConnectivity,
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

describe("offline detection and mutation queue", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
    setOnline(true);
    configureDataLayer({
      syncMaxRetries: 2,
      syncInitialDelayMs: 0,
      syncMaxDelayMs: 0,
    });
  });

  afterEach(() => {
    stopConnectivityMonitor();
    global.fetch = originalFetch;
  });

  it("starts in an online state", () => {
    expect(isOnline()).toBe(true);
  });

  it("transitions to offline", () => {
    const seen: boolean[] = [];
    const stop = subscribeConnectivity((online) => seen.push(online));
    setOnline(false);
    expect(isOnline()).toBe(false);
    expect(seen).toEqual([false]);
    stop();
  });

  it("transitions back online", () => {
    setOnline(false);
    setOnline(true);
    expect(isOnline()).toBe(true);
  });

  it("reacts to browser online/offline events", () => {
    startConnectivityMonitor();
    window.dispatchEvent(new Event("offline"));
    expect(isOnline()).toBe(false);
    window.dispatchEvent(new Event("online"));
    expect(isOnline()).toBe(true);
  });

  it("serves cached data while offline", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [1, 2] }));
    await getJson({ url: "/api/dashboard", tags: ["dashboard"], persist: true });

    setOnline(false);
    const cached = await getJson({ url: "/api/dashboard", tags: ["dashboard"], persist: true });
    expect(cached.fromCache).toBe(true);
    expect(cached.data).toEqual({ items: [1, 2] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when offline and the cache is empty", async () => {
    setOnline(false);
    await expect(getJson({ url: "/api/missing" })).rejects.toBeInstanceOf(OfflineCacheMissError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queues a mutation while offline", async () => {
    setOnline(false);
    const result = await mutate({
      method: "POST",
      url: "/clips/post",
      body: { clipIds: ["c1"] },
      queueWhenOffline: true,
      mutationType: "clips.post",
    });

    expect(result.queued).toBe(true);
    expect(result.ok).toBe(true);
    expect(getPendingMutations()).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("persists the queued mutation", async () => {
    setOnline(false);
    await mutate({
      method: "POST",
      url: "/clips/post",
      body: { clipIds: ["c1"] },
      queueWhenOffline: true,
    });

    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? "[]") as unknown[];
    expect(parsed).toHaveLength(1);
  });

  it("synchronizes queued mutations after reconnect", async () => {
    setOnline(false);
    await mutate({
      method: "POST",
      url: "/clips/post",
      body: { clipIds: ["c1"] },
      queueWhenOffline: true,
      invalidateTags: ["clips"],
    });

    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    setOnline(true);
    const report = await syncQueuedMutations();

    expect(report.succeeded).toBe(1);
    expect(report.failed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getPendingMutations()).toHaveLength(0);
  });

  it("records a successful synchronization", async () => {
    setOnline(false);
    await mutate({
      method: "PUT",
      url: "/users/1/onboarding",
      body: { step: 2 },
      idempotencyKey: "onboarding.save|1",
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    setOnline(true);
    const report = await syncQueuedMutations();
    expect(report.succeeded).toBe(1);
    expect(getQueuedMutations().every((item) => item.status === "completed")).toBe(true);
  });

  it("records a failed synchronization without blocking later items", async () => {
    setOnline(false);
    await mutate({
      method: "POST",
      url: "/clips/post",
      body: { id: "a" },
      mutationType: "clips.post",
    });
    await mutate({
      method: "POST",
      url: "/clips/post",
      body: { id: "b" },
      mutationType: "clips.post",
    });

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "nope" }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: "nope" }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: "nope" }, 500))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    setOnline(true);
    const report = await syncQueuedMutations();
    expect(report.failed).toBe(1);
    expect(report.succeeded).toBe(1);
  });

  it("retries retryable failures up to the configured limit", async () => {
    setOnline(false);
    await mutate({
      method: "POST",
      url: "/clips/post",
      body: { clipIds: ["c1"] },
    });

    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    setOnline(true);
    const report = await syncQueuedMutations();
    expect(report.succeeded).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not replay a mutation that already completed", async () => {
    setOnline(false);
    await mutate({
      method: "POST",
      url: "/clips/post",
      body: { clipIds: ["c1"] },
      idempotencyKey: "clips.post|same",
    });
    await mutate({
      method: "POST",
      url: "/clips/post",
      body: { clipIds: ["c1"] },
      idempotencyKey: "clips.post|same",
    });

    expect(getPendingMutations()).toHaveLength(1);

    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    setOnline(true);
    await syncQueuedMutations();
    await syncQueuedMutations();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("automatically synchronizes when connectivity returns", async () => {
    const stop = startAutomaticSync();
    setOnline(false);
    await mutate({
      method: "POST",
      url: "/clips/post",
      body: { clipIds: ["c4"] },
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    setOnline(true);
    for (let i = 0; i < 20 && fetchMock.mock.calls.length === 0; i += 1) {
      await Promise.resolve();
    }
    expect(fetchMock).toHaveBeenCalled();
    stop();
  });
});
