/**
 * Video resource release (Issue #1066).
 *
 * jsdom has no media stack, so this cannot assert that a decoded buffer was
 * freed. What it can assert is the thing that was actually missing: that the
 * release sequence runs at all, in the right order, on unmount and on a source
 * swap. That is the defect — the buffers were never asked to go.
 */

import React, { useRef } from "react";
import { render } from "@testing-library/react";
import { releaseVideoElement, useVideoRelease } from "@/app/hooks/useVideoRelease";

/** jsdom does not implement these; record the calls instead. */
function stubMediaMethods(video: HTMLVideoElement, calls: string[]) {
  video.pause = jest.fn(() => {
    calls.push("pause");
  });
  video.load = jest.fn(() => {
    calls.push("load");
  });
}

function Player({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useVideoRelease(ref, src);
  return <video ref={ref} src={src} data-testid="video" />;
}

describe("releaseVideoElement", () => {
  it("pauses, clears the source, then reloads — in that order", () => {
    const calls: string[] = [];
    const video = document.createElement("video");
    video.setAttribute("src", "https://cdn.example/clip.mp4");
    stubMediaMethods(video, calls);

    releaseVideoElement(video);

    // pause() must precede load(): load() on a playing element aborts
    // mid-teardown instead of releasing cleanly.
    expect(calls).toEqual(["pause", "load"]);
    expect(video.hasAttribute("src")).toBe(false);
  });

  it("removes the src attribute rather than blanking it", () => {
    const video = document.createElement("video");
    video.setAttribute("src", "https://cdn.example/clip.mp4");
    stubMediaMethods(video, []);

    releaseVideoElement(video);

    // `video.src = ""` would resolve against the document URL and make the
    // element fetch the page as media. The attribute has to go entirely.
    expect(video.getAttribute("src")).toBeNull();
    expect(video.src).not.toContain("clip.mp4");
  });

  it("clears <source> children too", () => {
    const video = document.createElement("video");
    const source = document.createElement("source");
    source.setAttribute("src", "https://cdn.example/clip.webm");
    video.appendChild(source);
    stubMediaMethods(video, []);

    releaseVideoElement(video);

    // Left in place, load() would just re-select one of them.
    expect(source.hasAttribute("src")).toBe(false);
  });

  it("is a no-op on null", () => {
    expect(() => releaseVideoElement(null)).not.toThrow();
  });

  it("never throws out of a teardown path", () => {
    const video = document.createElement("video");
    video.pause = jest.fn(() => {
      throw new Error("media stack unavailable");
    });

    expect(() => releaseVideoElement(video)).not.toThrow();
  });
});

describe("useVideoRelease", () => {
  it("releases the element on unmount", () => {
    const calls: string[] = [];
    const { getByTestId, unmount } = render(<Player src="https://cdn.example/a.mp4" />);
    const video = getByTestId("video") as HTMLVideoElement;
    stubMediaMethods(video, calls);

    expect(calls).toEqual([]);
    unmount();

    expect(calls).toEqual(["pause", "load"]);
    expect(video.hasAttribute("src")).toBe(false);
  });

  it("releases the previous resource when the source changes", () => {
    const calls: string[] = [];
    const { getByTestId, rerender } = render(<Player src="https://cdn.example/a.mp4" />);
    const video = getByTestId("video") as HTMLVideoElement;
    stubMediaMethods(video, calls);

    // The element stays mounted across a source swap, so nothing would run a
    // cleanup — this is the case a plain unmount handler misses.
    rerender(<Player src="https://cdn.example/b.mp4" />);

    expect(calls).toEqual(["pause", "load"]);
  });

  it("does not release while the source is unchanged", () => {
    const calls: string[] = [];
    const { getByTestId, rerender } = render(<Player src="https://cdn.example/a.mp4" />);
    const video = getByTestId("video") as HTMLVideoElement;
    stubMediaMethods(video, calls);

    rerender(<Player src="https://cdn.example/a.mp4" />);

    expect(calls).toEqual([]);
  });

  it("does not accumulate elements across repeated mount/unmount cycles", () => {
    // The shape of the original bug: open a preview, close it, open the next.
    for (let i = 0; i < 25; i += 1) {
      const { getByTestId, unmount } = render(
        <Player src={`https://cdn.example/clip-${i}.mp4`} />,
      );
      const video = getByTestId("video") as HTMLVideoElement;
      stubMediaMethods(video, []);
      unmount();
      expect(video.hasAttribute("src")).toBe(false);
    }

    expect(document.querySelectorAll("video")).toHaveLength(0);
  });
});
