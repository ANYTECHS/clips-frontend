import { renderHook, waitFor } from "@testing-library/react";
import { useGlobalSearch } from "@/app/hooks/useGlobalSearch";

describe("useGlobalSearch (issue #798)", () => {
  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { clips: [{ type: "clip", id: "1", title: "Clip #01", href: "/projects" }], projects: [], earnings: [] },
        error: null,
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("returns null results and does not fetch for a blank query", () => {
    const { result } = renderHook(() => useGlobalSearch(""));
    expect(result.current.results).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("debounces the request by 300ms", async () => {
    const { result, rerender } = renderHook(({ q }) => useGlobalSearch(q), {
      initialProps: { q: "cl" },
    });
    rerender({ q: "cli" });
    rerender({ q: "clip" });

    jest.advanceTimersByTime(200);
    expect(fetch).not.toHaveBeenCalled();

    jest.advanceTimersByTime(150);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("q=clip"));

    await waitFor(() => expect(result.current.results?.clips).toHaveLength(1));
  });

  it("sets an error and empty results when the request fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const { result } = renderHook(() => useGlobalSearch("clip"));
    jest.advanceTimersByTime(300);

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.results).toEqual({ clips: [], projects: [], earnings: [] });
  });
});
