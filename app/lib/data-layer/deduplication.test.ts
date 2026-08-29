import {
  configureDataLayer,
  getDedupMetrics,
  getJson,
  resetDedupMetrics,
} from "@/app/lib/data-layer";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as Response;
}

describe("request deduplication", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
    resetDedupMetrics();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it("collapses identical concurrent requests into one network call", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const a = getJson({ url: "/api/dashboard", tags: ["dashboard"] });
    const b = getJson({ url: "/api/dashboard", tags: ["dashboard"] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch?.(jsonResponse({ data: [1] }));

    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.data).toEqual({ data: [1] });
    expect(rb.data).toEqual({ data: [1] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reuses identical requests within the deduplication window", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    configureDataLayer({ dedupeWindowMs: 50, cacheTtlMs: 0, staleTtlMs: 0 });
    fetchMock.mockResolvedValue(jsonResponse({ n: 1 }));

    await getJson({ url: "/api/window", cache: false, dedupeWindowMs: 50 });
    await getJson({ url: "/api/window", cache: false, dedupeWindowMs: 50 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("executes normally after the deduplication window expires", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    fetchMock.mockResolvedValue(jsonResponse({ n: 1 }));

    await getJson({ url: "/api/window-expire", cache: false, dedupeWindowMs: 50 });
    jest.setSystemTime(new Date("2026-01-01T00:00:00.051Z"));
    await getJson({ url: "/api/window-expire", cache: false, dedupeWindowMs: 50 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not deduplicate different URLs", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await Promise.all([
      getJson({ url: "/api/dashboard", cache: false }),
      getJson({ url: "/api/earnings", cache: false }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not deduplicate different query parameters", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await Promise.all([
      getJson({ url: "/api/dashboard", params: { range: "a" }, cache: false }),
      getJson({ url: "/api/dashboard", params: { range: "b" }, cache: false }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not deduplicate different request bodies", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await Promise.all([
      getJson({ method: "GET", url: "/api/search", body: { q: "alpha" }, cache: false }),
      getJson({ method: "GET", url: "/api/search", body: { q: "beta" }, cache: false }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cleans up rejected requests so the next call can retry", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockResolvedValueOnce(jsonResponse({ recovered: true }));

    await expect(getJson({ url: "/api/flaky", cache: false })).rejects.toThrow("Failed to fetch");
    const recovered = await getJson({ url: "/api/flaky", cache: false });
    expect(recovered.data).toEqual({ recovered: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("updates deduplication metrics", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const a = getJson({ url: "/api/metrics", cache: false });
    const b = getJson({ url: "/api/metrics", cache: false });
    resolveFetch?.(jsonResponse({ ok: true }));
    await Promise.all([a, b]);

    const metrics = getDedupMetrics();
    expect(metrics.requestCount).toBe(2);
    expect(metrics.deduplicatedCount).toBe(1);
    expect(metrics.networkCount).toBe(1);
    expect(metrics.deduplicationRate).toBe(0.5);
  });
});
