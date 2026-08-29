/**
 * __tests__/hooks/useMemoryMonitor.test.tsx
 */

import React from "react";
import { render, act } from "@testing-library/react";
import { useMemoryMonitor } from "@/app/hooks/useMemoryMonitor";

jest.mock("@/app/lib/performanceMonitoring", () => ({
  reportMetric: jest.fn(),
}));

import { reportMetric } from "@/app/lib/performanceMonitoring";

function Harness(props: Parameters<typeof useMemoryMonitor>[0]) {
  useMemoryMonitor(props);
  return null;
}

function setPerformanceMemory(memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | undefined) {
  Object.defineProperty(performance, "memory", {
    value: memory,
    configurable: true,
  });
}

describe("useMemoryMonitor", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete (performance as any).memory;
  });

  it("does nothing where performance.memory is unavailable (e.g. this test environment)", () => {
    const baseline = jest.getTimerCount();
    const { unmount } = render(<Harness />);

    expect(jest.getTimerCount()).toBe(baseline);
    expect(reportMetric).not.toHaveBeenCalled();
    unmount();
  });

  it("samples immediately and on each interval when supported, reporting a heap-used ratio", () => {
    setPerformanceMemory({ usedJSHeapSize: 50_000_000, totalJSHeapSize: 80_000_000, jsHeapSizeLimit: 100_000_000 });

    render(<Harness intervalMs={1000} />);

    expect(reportMetric).toHaveBeenCalledTimes(1);
    expect(reportMetric).toHaveBeenCalledWith(
      "memory.heapUsedRatio",
      0.5,
      expect.objectContaining({ usedMB: expect.any(Number), totalMB: expect.any(Number) }),
    );

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(reportMetric).toHaveBeenCalledTimes(4);
  });

  it("clears its interval on unmount", () => {
    setPerformanceMemory({ usedJSHeapSize: 1, totalJSHeapSize: 2, jsHeapSizeLimit: 10 });
    const baseline = jest.getTimerCount();

    const { unmount } = render(<Harness intervalMs={1000} />);
    expect(jest.getTimerCount()).toBe(baseline + 1);

    unmount();
    expect(jest.getTimerCount()).toBe(baseline);
  });

  it("does not sample when disabled", () => {
    setPerformanceMemory({ usedJSHeapSize: 1, totalJSHeapSize: 2, jsHeapSizeLimit: 10 });
    render(<Harness enabled={false} />);

    expect(reportMetric).not.toHaveBeenCalled();
  });
});
