import { renderHook } from "@testing-library/react";
import { RequestCache } from "@/app/lib/cache/RequestCache";
import { useCachedFetch } from "./useCachedFetch";

describe("useCachedFetch cancellation", () => {
  it("aborts the active request when unmounted", () => {
    const cache = new RequestCache();
    let signal: AbortSignal | undefined;
    const fetcher = jest.fn((requestSignal?: AbortSignal) => {
      signal = requestSignal;
      return new Promise<unknown>(() => {});
    });

    const { unmount } = renderHook(() =>
      useCachedFetch("cancellation-test", fetcher, { cache }),
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(signal?.aborted).toBe(false);

    unmount();

    expect(signal?.aborted).toBe(true);
  });
});