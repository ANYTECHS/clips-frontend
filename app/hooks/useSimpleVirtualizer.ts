"use client";

/**
 * Dependency-free row virtualizer.
 *
 * `@tanstack/react-virtual` was adopted for the clips grid and the
 * transaction list but never added to package.json, so both call sites
 * threw at render time (`require`/import of a module that doesn't exist).
 * This is a minimal stand-in with the same `getVirtualItems`/`getTotalSize`
 * shape so those call sites keep only rendering the rows near the viewport
 * without pulling in a new dependency.
 *
 * Only fixed-size rows are supported — every row is assumed to be
 * `estimateSize` tall, which holds for both current uses (grid rows of
 * clip cards, transaction rows).
 */

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";

export interface VirtualItem {
  index: number;
  start: number;
  size: number;
}

export interface UseSimpleVirtualizerOptions {
  count: number;
  estimateSize: number;
  overscan?: number;
  /** Scrollable container; omit to virtualize against window scroll. */
  getScrollElement?: () => HTMLElement | null;
  /** Needed in window-scroll mode to know where the list starts on the page. */
  containerRef?: RefObject<HTMLElement | null>;
}

export function useSimpleVirtualizer({
  count,
  estimateSize,
  overscan = 3,
  getScrollElement,
  containerRef,
}: UseSimpleVirtualizerOptions) {
  const [range, setRange] = useState({ start: 0, end: Math.min(count, overscan * 2 + 10) });

  const recalc = useCallback(() => {
    const scrollEl = getScrollElement ? getScrollElement() : null;
    const viewportSize = scrollEl ? scrollEl.clientHeight : window.innerHeight;
    const scrollTop = scrollEl ? scrollEl.scrollTop : window.scrollY;
    const containerTop = scrollEl
      ? 0
      : containerRef?.current
        ? containerRef.current.getBoundingClientRect().top + window.scrollY
        : 0;

    const relativeScroll = Math.max(0, scrollTop - containerTop);
    const start = Math.max(0, Math.floor(relativeScroll / estimateSize) - overscan);
    const visibleCount = Math.ceil(viewportSize / estimateSize) + overscan * 2;
    const end = Math.min(count, start + visibleCount);

    setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [count, estimateSize, overscan, getScrollElement, containerRef]);

  useEffect(() => {
    recalc();
    const scrollEl = getScrollElement ? getScrollElement() : null;
    const target: Window | HTMLElement = scrollEl ?? window;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recalc);
    };

    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [recalc, getScrollElement]);

  const virtualItems = useMemo(() => {
    const items: VirtualItem[] = [];
    for (let i = range.start; i < range.end; i++) {
      items.push({ index: i, start: i * estimateSize, size: estimateSize });
    }
    return items;
  }, [range, estimateSize]);

  return {
    getVirtualItems: () => virtualItems,
    getTotalSize: () => count * estimateSize,
  };
}
