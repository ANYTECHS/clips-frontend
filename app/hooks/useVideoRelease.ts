"use client";

/**
 * Releases a `<video>` element's media resource (Issue #1066).
 *
 * # What actually leaks
 *
 * React removes the `<video>` node on unmount, but removal alone does not free
 * what the element is holding. While an element has a `src`, the browser keeps
 * its media resource alive: the decoded frame buffer, the demuxer, and the
 * pending range requests. Dropping the last DOM reference makes it *eligible*
 * for collection, but the media stack is off-heap and collected on its own
 * schedule — and an element whose network state is still `NETWORK_LOADING`
 * keeps fetching in the meantime.
 *
 * In a modal or a comparison view, that is the whole problem: open a clip,
 * close it, open the next, and each one leaves a buffer behind. After a few
 * dozen previews the tab is holding hundreds of megabytes of video it will
 * never show again, which is the degradation this issue describes.
 *
 * # The release sequence
 *
 * `pause()` → clear `src` (and any `<source>` children) → `load()`.
 *
 * All three matter, in that order:
 *
 *   - `pause()` first, because `load()` on a playing element fires an abort
 *     and leaves the decoder mid-teardown.
 *   - `removeAttribute('src')` rather than `video.src = ''`, because assigning
 *     an empty string resolves against the document URL and makes the element
 *     fetch the *page* as media — a real request, and a `MEDIA_ERR_SRC_NOT_
 *     SUPPORTED` in the console.
 *   - `load()` last: it is what tells the element to re-run resource selection
 *     against the now-absent source, which is what actually frees the buffer.
 *     Clearing `src` without it leaves the old resource attached.
 */

import { type RefObject,useEffect } from "react";

import { logger } from "@/app/lib/logger";

/**
 * Live-element counter, development only (Issue #1066).
 *
 * The leak is invisible in the React tree — the components unmount correctly;
 * it is the media resources underneath that linger. Counting elements that
 * have been mounted but not released turns "the tab feels slow after a while"
 * into a number that moves the moment a new player forgets its cleanup.
 *
 * Deliberately a count and not a heap reading: `performance.memory` is noisy
 * enough that a single sample proves nothing, whereas an unreleased element is
 * a definite fact. `useMemoryMonitor` covers the heap trend separately.
 */
const isDev = process.env.NODE_ENV === "development";

/** Elements that are expected to be released but have not been yet. */
let liveVideoElements = 0;

/** Live players above this are worth a warning — no real view shows more. */
const LIVE_ELEMENT_WARN_THRESHOLD = 8;

function trackMounted(): void {
  if (!isDev) return;
  liveVideoElements += 1;

  if (liveVideoElements > LIVE_ELEMENT_WARN_THRESHOLD) {
    logger.warn(
      `[video] ${liveVideoElements} video elements are mounted without being ` +
        `released. If this number only goes up as you navigate, a player is ` +
        `missing useVideoRelease — see app/hooks/useVideoRelease.ts.`
    );
  }
}

function trackReleased(): void {
  if (!isDev) return;
  liveVideoElements = Math.max(0, liveVideoElements - 1);
}

/** Current count of tracked, unreleased video elements. Development only. */
export function getLiveVideoElementCount(): number {
  return liveVideoElements;
}

/** Release a media element's resource. Safe to call on a detached element. */
export function releaseVideoElement(video: HTMLVideoElement | null): void {
  if (!video) return;

  try {
    video.pause();

    // A <video> can source from the attribute or from child <source> nodes.
    // Leaving the children in place means load() re-selects one of them.
    const sources = video.querySelectorAll("source");
    sources.forEach((source) => source.removeAttribute("src"));

    video.removeAttribute("src");
    video.load();
  } catch {
    // Teardown must never throw into an unmount path — a failed release is a
    // leak, but a throw here breaks the component tree above it.
  }
}

/**
 * Release the referenced video when the component unmounts, and whenever
 * `sourceKey` changes.
 *
 * `sourceKey` covers the case a plain unmount cleanup misses: swapping the
 * `src` on a mounted element. The element stays, so no cleanup runs, and the
 * previous resource is orphaned while still attached to the same node.
 */
export function useVideoRelease(ref: RefObject<HTMLVideoElement | null>, sourceKey?: string): void {
  useEffect(() => {
    const video = ref.current;
    trackMounted();

    return () => {
      releaseVideoElement(video);
      trackReleased();
    };
    // `ref` is stable; `sourceKey` re-runs the cleanup on a source swap.
  }, [ref, sourceKey]);
}

/**
 * Release several videos at once, for components showing more than one.
 */
export function useVideoReleaseAll(
  refs: RefObject<HTMLVideoElement | null>[],
  sourceKey?: string
): void {
  useEffect(() => {
    const videos = refs.map((ref) => ref.current);
    videos.forEach(trackMounted);

    return () => {
      videos.forEach(releaseVideoElement);
      videos.forEach(trackReleased);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);
}
