"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { VIRTUALIZATION_CONFIG } from "@/app/lib/virtualizationConfig";

export interface UseWindowVirtualizerOptions {
  /** Total number of items being laid out. */
  count: number;
  /** Items per row. Pass 1 for a plain vertical list. */
  columns: number;
  /** Height of a single row, in pixels. */
  rowHeight: number;
  /** Vertical gap between rows, in pixels. */
  gap?: number;
  /** Extra pixels rendered above/below the viewport. */
  overscanPx?: number;
}

export interface VirtualRow {
  rowIndex: number;
  top: number;
}

export interface UseWindowVirtualizerResult {
  /** Attach to the element that wraps all rows (its top edge anchors the math). */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Total scrollable height of the full (non-virtualized) content. */
  totalHeight: number;
  /** The rows currently within the viewport (+ overscan) that should be mounted. */
  virtualRows: VirtualRow[];
}

/**
 * Windows a fixed-row-height list or grid against the *window's* scroll
 * position (rather than an inner scroll container), since that's how most
 * feeds/tables in this app are laid out — the page scrolls, not a fixed-height
 * box. Only rows within the viewport (plus `overscanPx`) are reported back;
 * everything else is left out of `virtualRows` so the caller can skip
 * mounting it, while `totalHeight` keeps the scrollbar/page height correct.
 *
 * Rows are assumed fixed-height. Variable-height content should reserve
 * `rowHeight` worth of space (e.g. via `minHeight` + internal truncation)
 * rather than growing past it, or the windowing math drifts.
 */
export function useWindowVirtualizer({
  count,
  columns,
  rowHeight,
  gap = 0,
  overscanPx = VIRTUALIZATION_CONFIG.overscanPx,
}: UseWindowVirtualizerOptions): UseWindowVirtualizerResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const rowCount = columns > 0 ? Math.ceil(count / columns) : 0;
  const rowStride = rowHeight + gap;
  const totalHeight = rowCount > 0 ? rowCount * rowStride - gap : 0;

  const [range, setRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: Math.min(rowCount, 20),
  });

  useEffect(() => {
    const recompute = () => {
      const el = containerRef.current;
      if (!el || rowStride <= 0) return;

      const rect = el.getBoundingClientRect();
      const viewportTop = -rect.top - overscanPx;
      const viewportBottom = window.innerHeight - rect.top + overscanPx;

      const startRow = Math.max(0, Math.floor(viewportTop / rowStride));
      const endRow = Math.min(rowCount, Math.ceil(viewportBottom / rowStride));

      setRange((prev) => (prev.start === startRow && prev.end === endRow ? prev : { start: startRow, end: endRow }));
    };

    recompute();

    let ticking = false;
    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        recompute();
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [rowCount, rowStride, overscanPx]);

  const clampedRange = useMemo(
    () => ({ start: Math.min(range.start, rowCount), end: Math.min(range.end, rowCount) }),
    [range, rowCount],
  );

  const virtualRows = useMemo(() => {
    const rows: VirtualRow[] = [];
    for (let rowIndex = clampedRange.start; rowIndex < clampedRange.end; rowIndex++) {
      rows.push({ rowIndex, top: rowIndex * rowStride });
    }
    return rows;
  }, [clampedRange, rowStride]);

  return { containerRef, totalHeight, virtualRows };
}
