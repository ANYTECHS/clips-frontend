/**
 * @jest-environment node
 */
import { GET, _resetCache, CACHE_TTL_MS } from "@/app/api/prices/xlm/route";

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  _resetCache();
  mockFetch.mockReset();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("GET /api/prices/xlm", () => {
  it("cache miss: fetches CoinGecko and returns price", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stellar: { usd: 0.20 } }),
    });

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({ price: 0.20, stale: false });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("cache hit: does not call CoinGecko again within TTL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stellar: { usd: 0.20 } }),
    });

    await GET();
    mockFetch.mockReset();

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({ price: 0.20, stale: false });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("cache expiry: re-fetches CoinGecko after TTL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stellar: { usd: 0.20 } }),
    });

    await GET();
    jest.advanceTimersByTime(CACHE_TTL_MS + 1);

    await GET();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("429 with stale cache: serves last known price with stale=true", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stellar: { usd: 0.18 } }),
    });
    await GET(); // populate cache

    jest.advanceTimersByTime(CACHE_TTL_MS + 1); // expire cache

    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({ price: 0.18, stale: true });
  });

  it("429 with no prior cache: returns fallback price", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });

    const res = await GET();
    const body = await res.json();

    expect(body.stale).toBe(true);
    expect(typeof body.price).toBe("number");
  });

  it("network error: returns fallback price with stale=true", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network failure"));

    const res = await GET();
    const body = await res.json();

    expect(body.stale).toBe(true);
    expect(typeof body.price).toBe("number");
  });
});
