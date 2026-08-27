/**
 * Tests for the cancellable animation frame loop (#879).
 *
 * The failure mode being guarded against is a loop that outlives its component
 * or keeps running in a hidden tab, so these assert on cancellation as much as
 * on the callback firing.
 */

import { act, renderHook } from "@testing-library/react";
import { useAnimationFrame } from "@/app/hooks/useAnimationFrame";

/** Drives rAF manually so frames advance only when a test says so. */
function installFrameClock() {
  let nextHandle = 1;
  const scheduled = new Map<number, FrameRequestCallback>();

  const raf = jest
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((cb: FrameRequestCallback) => {
      const handle = nextHandle++;
      scheduled.set(handle, cb);
      return handle;
    });

  const caf = jest
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation((handle: number) => {
      scheduled.delete(handle);
    });

  return {
    raf,
    caf,
    /** Run every currently-scheduled frame at timestamp `time`. */
    advance(time: number) {
      const due = [...scheduled.entries()];
      scheduled.clear();
      act(() => {
        due.forEach(([, cb]) => cb(time));
      });
    },
    get pending() {
      return scheduled.size;
    },
  };
}

let clock: ReturnType<typeof installFrameClock>;

beforeEach(() => {
  clock = installFrameClock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("useAnimationFrame", () => {
  it("reports the delta between frames, skipping the first", () => {
    const onFrame = jest.fn();
    renderHook(() => useAnimationFrame(onFrame));

    // The first frame has no previous timestamp to measure from.
    clock.advance(1000);
    expect(onFrame).not.toHaveBeenCalled();

    clock.advance(1016);
    expect(onFrame).toHaveBeenCalledWith(16);

    clock.advance(1048);
    expect(onFrame).toHaveBeenLastCalledWith(32);
  });

  it("cancels the pending frame on unmount", () => {
    const { unmount } = renderHook(() => useAnimationFrame(jest.fn()));

    expect(clock.pending).toBe(1);

    unmount();

    expect(clock.caf).toHaveBeenCalled();
    expect(clock.pending).toBe(0);
  });

  it("does not schedule anything while disabled", () => {
    renderHook(() => useAnimationFrame(jest.fn(), { enabled: false }));

    expect(clock.raf).not.toHaveBeenCalled();
    expect(clock.pending).toBe(0);
  });

  it("stops when enabled flips to false and resumes when it flips back", () => {
    const onFrame = jest.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useAnimationFrame(onFrame, { enabled }),
      { initialProps: { enabled: true } },
    );

    expect(clock.pending).toBe(1);

    rerender({ enabled: false });
    expect(clock.pending).toBe(0);

    rerender({ enabled: true });
    expect(clock.pending).toBe(1);
  });

  it("swaps in a new callback without restarting the loop", () => {
    const first = jest.fn();
    const second = jest.fn();

    const { rerender } = renderHook(({ cb }) => useAnimationFrame(cb), {
      initialProps: { cb: first },
    });

    const scheduleCallsAfterMount = clock.raf.mock.calls.length;

    rerender({ cb: second });

    // Re-running the effect here would cancel and reschedule, dropping a frame.
    expect(clock.raf.mock.calls.length).toBe(scheduleCallsAfterMount);

    clock.advance(1000);
    clock.advance(1016);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(16);
  });

  it("pauses while the document is hidden and resumes when it returns", () => {
    const hidden = jest.spyOn(document, "hidden", "get");
    hidden.mockReturnValue(false);

    renderHook(() => useAnimationFrame(jest.fn()));
    expect(clock.pending).toBe(1);

    hidden.mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(clock.pending).toBe(0);

    hidden.mockReturnValue(false);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(clock.pending).toBe(1);
  });

  it("keeps running in a hidden tab when the caller opts out of pausing", () => {
    const hidden = jest.spyOn(document, "hidden", "get");
    hidden.mockReturnValue(false);

    renderHook(() =>
      useAnimationFrame(jest.fn(), { pauseWhenHidden: false }),
    );

    hidden.mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(clock.pending).toBe(1);
  });
});
