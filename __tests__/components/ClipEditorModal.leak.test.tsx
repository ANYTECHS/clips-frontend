/**
 * __tests__/components/ClipEditorModal.leak.test.tsx
 *
 * Regression test for a real leak: `handleGenerateCaptions` scheduled a
 * `setTimeout(loadCaptions, 1500)` with no reference kept to it, so closing
 * the modal within that window left the timer running — it would fire
 * `loadCaptions()` (several `setState` calls plus a `fetch`) against an
 * already-unmounted component. `jest.getTimerCount()` (Jest's count of
 * pending fake timers) makes this directly assertable: it should return to
 * its pre-mount baseline once the modal unmounts, never above it.
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ClipEditorModal from "@/components/projects/ClipEditorModal";
import type { Clip } from "@/components/projects/ClipGrid";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

const clip: Clip = {
  id: "clip-1",
  title: "Test clip",
  thumbnail: "/thumb.jpg",
  score: 90,
  scoreKey: "viral",
  duration: "0:30",
  style: "Bold & Dynamic",
  status: "ready",
  resolution: "1080x1920",
  videoUrl: "/clip.mp4",
};

async function flushMicrotasks() {
  await act(async () => {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  });
}

describe("ClipEditorModal caption-poll timer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: "queued", segments: [] } }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("clears the caption-poll timer on unmount instead of leaking it", async () => {
    const { unmount } = render(
      <ClipEditorModal clip={clip} onClose={jest.fn()} onSave={jest.fn()} />,
    );
    const baseline = jest.getTimerCount();

    fireEvent.click(screen.getByText("captions"));
    await flushMicrotasks();

    fireEvent.click(screen.getByText("Generate Captions"));
    await flushMicrotasks();

    expect(jest.getTimerCount()).toBeGreaterThan(baseline);

    unmount();

    expect(jest.getTimerCount()).toBe(baseline);
  });

  it("does not call loadCaptions again after unmount when the poll timer would have fired", async () => {
    const { unmount } = render(
      <ClipEditorModal clip={clip} onClose={jest.fn()} onSave={jest.fn()} />,
    );

    fireEvent.click(screen.getByText("captions"));
    await flushMicrotasks();

    fireEvent.click(screen.getByText("Generate Captions"));
    await flushMicrotasks();

    const fetchCallsBeforeUnmount = (global.fetch as jest.Mock).mock.calls.length;
    unmount();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallsBeforeUnmount);
  });
});
