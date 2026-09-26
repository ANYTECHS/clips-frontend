/**
 * Tests for animation frame-rate sampling (#879).
 */

import { act, renderHook } from "@testing-library/react";
import { useAnimationFrameRate } from "@/app/hooks/useAnimationFrameRate";
import { reportMetric } from "@/app/lib/performanceMonitoring";

jest.mock("@/app/lib/performanceMonitoring", () => ({
  reportMetric: jest.fn(),
}));

const reportMetricMock = reportMetric as jest.Mock;

function installFrameClock() {
  let nextHandle = 1;
  const scheduled = new Map<number, FrameRequestCallback>();

  jest
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((cb: FrameRequestCallback) => {
      const handle = nextHandle++;
      scheduled.set(handle, cb);
      return handle;
    });
  jest
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation((handle: number) => {
      scheduled.delete(handle);
    });

  return {
    /** Deliver `count` frames spaced `stepMs` apart. */
    run(count: number, stepMs: number, startAt = 1000) {
      let time = startAt;
      for (let i = 0; i < count; i += 1) {
        const due = [...scheduled.entries()];
        scheduled.clear();
        act(() => {
          due.forEach(([, cb]) => cb(time));
        });
        time += stepMs;
      }
    },
  };
}

let clock: ReturnType<typeof installFrameClock>;

beforeEach(() => {
  jest.clearAllMocks();
  clock = installFrameClock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useAnimationFrameRate", () => {
  it("does not sample unless explicitly enabled", () => {
    renderHook(() => useAnimationFrameRate("carousel"));

    clock.run(20, 16);

    expect(reportMetricMock).not.toHaveBeenCalled();
  });

  it("reports average FPS once the sample window fills", () => {
    renderHook(() =>
      useAnimationFrameRate("carousel", { enabled: true, sampleSize: 4 }),
    );

    // 5 frames at 16ms apart yields 4 measured deltas of 16ms each -> 62.5 FPS.
    clock.run(5, 16);

    expect(reportMetricMock).toHaveBeenCalledTimes(1);
    const [name, value, attributes] = reportMetricMock.mock.calls[0];
    expect(name).toBe("animation.fps.carousel");
    expect(value).toBeCloseTo(62.5, 1);
    expect(attributes).toEqual({ frames: 4 });
  });

  it("reports a low frame rate for slow frames", () => {
    renderHook(() =>
      useAnimationFrameRate("heavy", { enabled: true, sampleSize: 4 }),
    );

    // 100ms per frame is 10 FPS — the jank this metric exists to surface.
    clock.run(5, 100);

    expect(reportMetricMock.mock.calls[0][1]).toBeCloseTo(10, 1);
  });

  it("keeps sampling across successive windows", () => {
    renderHook(() =>
      useAnimationFrameRate("carousel", { enabled: true, sampleSize: 2 }),
    );

    clock.run(7, 16);

    expect(reportMetricMock.mock.calls.length).toBeGreaterThan(1);
  });

  it("reports only once when the caller asks for a single sample", () => {
    renderHook(() =>
      useAnimationFrameRate("intro", {
        enabled: true,
        sampleSize: 2,
        once: true,
      }),
    );

    clock.run(9, 16);

    expect(reportMetricMock).toHaveBeenCalledTimes(1);
  });

  it("stops sampling once unmounted", () => {
    const { unmount } = renderHook(() =>
      useAnimationFrameRate("carousel", { enabled: true, sampleSize: 2 }),
    );

    unmount();
    clock.run(10, 16);

    expect(reportMetricMock).not.toHaveBeenCalled();
  });
});
