/**
 * __tests__/hooks/useWindowVirtualizer.test.ts
 *
 * Unit tests for the window-scroll-based list/grid virtualizer. The hook's
 * `containerRef` only does anything once attached to a real DOM node, so
 * these render a tiny harness component rather than using `renderHook`
 * directly.
 */

import React from "react";
import { render } from "@testing-library/react";
import { useWindowVirtualizer, type UseWindowVirtualizerResult } from "@/app/hooks/useWindowVirtualizer";

function mockContainerTop(top: number) {
  jest.spyOn(HTMLDivElement.prototype, "getBoundingClientRect").mockReturnValue({
    top,
    bottom: top,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: top,
    toJSON() {},
  } as DOMRect);
}

function Harness({
  count,
  columns,
  rowHeight,
  gap,
  overscanPx,
  capture,
}: {
  count: number;
  columns: number;
  rowHeight: number;
  gap?: number;
  overscanPx?: number;
  capture: (result: UseWindowVirtualizerResult) => void;
}) {
  const result = useWindowVirtualizer({ count, columns, rowHeight, gap, overscanPx });
  capture(result);
  return <div ref={result.containerRef} />;
}

describe("useWindowVirtualizer", () => {
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(window, "innerHeight", { value: originalInnerHeight, configurable: true });
  });

  it("computes total height from row count and stride", () => {
    mockContainerTop(0);
    let latest: UseWindowVirtualizerResult | undefined;
    render(<Harness count={100} columns={2} rowHeight={50} gap={10} capture={(r) => (latest = r)} />);

    // 100 items / 2 columns = 50 rows; 50 * (50 + 10) - 10 (no trailing gap)
    expect(latest!.totalHeight).toBe(50 * 60 - 10);
  });

  it("only reports rows within the viewport (+ overscan), not the full set", () => {
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    mockContainerTop(0);

    let latest: UseWindowVirtualizerResult | undefined;
    render(<Harness count={500} columns={1} rowHeight={50} overscanPx={100} capture={(r) => (latest = r)} />);

    expect(latest!.virtualRows.length).toBeGreaterThan(0);
    expect(latest!.virtualRows.length).toBeLessThan(500);
    expect(latest!.virtualRows[0].rowIndex).toBe(0);
  });

  it("windows to a later range when the container sits far above the viewport", () => {
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    mockContainerTop(-5000);

    let latest: UseWindowVirtualizerResult | undefined;
    render(<Harness count={500} columns={1} rowHeight={50} overscanPx={0} capture={(r) => (latest = r)} />);

    // Container top is -5000px relative to the viewport, so the first
    // visible row is roughly 5000 / 50 = 100 rows in.
    expect(latest!.virtualRows[0].rowIndex).toBeGreaterThan(90);
  });

  it("returns an empty range when count is 0", () => {
    mockContainerTop(0);
    let latest: UseWindowVirtualizerResult | undefined;
    render(<Harness count={0} columns={3} rowHeight={50} capture={(r) => (latest = r)} />);

    expect(latest!.totalHeight).toBe(0);
    expect(latest!.virtualRows).toHaveLength(0);
  });
});
