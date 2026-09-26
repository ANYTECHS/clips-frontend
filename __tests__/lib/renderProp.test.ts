/**
 * __tests__/lib/renderProp.test.ts
 *
 * Unit tests for the render-prop memoization helpers.
 */

import { renderHook } from "@testing-library/react";
import { useRenderPropResult, RenderPropCache } from "@/app/lib/renderProp";

describe("useRenderPropResult", () => {
  it("returns undefined and does not call the render prop when it is undefined", () => {
    const { result } = renderHook(() => useRenderPropResult(undefined, [1] as const));
    expect(result.current).toBeUndefined();
  });

  it("caches the result across re-renders when args are unchanged", () => {
    const renderProp = jest.fn((a: number, b: number) => a + b);
    const { result, rerender } = renderHook(
      ({ a, b }) => useRenderPropResult(renderProp, [a, b] as const),
      { initialProps: { a: 1, b: 2 } },
    );

    expect(result.current).toBe(3);
    expect(renderProp).toHaveBeenCalledTimes(1);

    rerender({ a: 1, b: 2 });
    expect(renderProp).toHaveBeenCalledTimes(1);
  });

  it("recomputes when args change", () => {
    const renderProp = jest.fn((a: number, b: number) => a + b);
    const { result, rerender } = renderHook(
      ({ a, b }) => useRenderPropResult(renderProp, [a, b] as const),
      { initialProps: { a: 1, b: 2 } },
    );

    rerender({ a: 1, b: 3 });
    expect(result.current).toBe(4);
    expect(renderProp).toHaveBeenCalledTimes(2);
  });

  it("recomputes when the function identity changes", () => {
    const renderPropA = (a: number) => a * 2;
    const renderPropB = (a: number) => a * 2;
    const { result, rerender } = renderHook(
      ({ fn }: { fn: (a: number) => number }) => useRenderPropResult(fn, [5] as const),
      { initialProps: { fn: renderPropA } },
    );

    expect(result.current).toBe(10);
    rerender({ fn: renderPropB });
    expect(result.current).toBe(10);
  });
});

describe("RenderPropCache", () => {
  it("caches by key and recomputes only when the key changes", () => {
    const cache = new RenderPropCache<[string], string>();
    const compute = jest.fn(() => "computed");

    expect(cache.get(["a"], compute)).toBe("computed");
    expect(cache.get(["a"], compute)).toBe("computed");
    expect(compute).toHaveBeenCalledTimes(1);

    const computeB = jest.fn(() => "computed-b");
    expect(cache.get(["b"], computeB)).toBe("computed-b");
    expect(computeB).toHaveBeenCalledTimes(1);
  });
});
