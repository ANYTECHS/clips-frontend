import { renderHook, act } from "@testing-library/react";
import { useRoutePrefetch, PREFETCH_INTENT_DELAY_MS } from "./useRoutePrefetch";

const prefetch = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch: (...args: unknown[]) => prefetch(...args) }),
}));

describe("useRoutePrefetch", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    prefetch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not prefetch on mount", () => {
    renderHook(() => useRoutePrefetch("/earnings"));
    expect(prefetch).not.toHaveBeenCalled();
  });

  it("prefetches after the hover intent delay", () => {
    const { result } = renderHook(() => useRoutePrefetch("/earnings"));

    act(() => {
      result.current.onMouseEnter();
    });
    expect(prefetch).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(PREFETCH_INTENT_DELAY_MS);
    });
    expect(prefetch).toHaveBeenCalledWith("/earnings");
  });

  it("ignores a pointer that sweeps across on its way elsewhere", () => {
    const { result } = renderHook(() => useRoutePrefetch("/earnings"));

    act(() => {
      result.current.onMouseEnter();
      jest.advanceTimersByTime(PREFETCH_INTENT_DELAY_MS - 1);
      result.current.onMouseLeave();
      jest.advanceTimersByTime(1_000);
    });

    expect(prefetch).not.toHaveBeenCalled();
  });

  it("prefetches immediately on keyboard focus", () => {
    const { result } = renderHook(() => useRoutePrefetch("/earnings"));

    act(() => {
      result.current.onFocus();
    });

    expect(prefetch).toHaveBeenCalledWith("/earnings");
  });

  it("prefetches immediately on touch", () => {
    const { result } = renderHook(() => useRoutePrefetch("/wallet"));

    act(() => {
      result.current.onTouchStart();
    });

    expect(prefetch).toHaveBeenCalledWith("/wallet");
  });

  it("prefetches a route only once per mount", () => {
    const { result } = renderHook(() => useRoutePrefetch("/earnings"));

    act(() => {
      result.current.onFocus();
      result.current.onMouseEnter();
      jest.advanceTimersByTime(1_000);
      result.current.onTouchStart();
    });

    expect(prefetch).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending prefetch when the component unmounts", () => {
    const { result, unmount } = renderHook(() => useRoutePrefetch("/earnings"));

    act(() => {
      result.current.onMouseEnter();
    });
    unmount();
    act(() => {
      jest.advanceTimersByTime(1_000);
    });

    expect(prefetch).not.toHaveBeenCalled();
  });

  it("survives a router that throws", () => {
    prefetch.mockImplementation(() => {
      throw new Error("prefetch unavailable");
    });
    const { result } = renderHook(() => useRoutePrefetch("/earnings"));

    expect(() => {
      act(() => {
        result.current.onFocus();
      });
    }).not.toThrow();
  });
});
