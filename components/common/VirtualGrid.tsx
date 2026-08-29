"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@/app/hooks/useWindowVirtualizer";
import { VIRTUALIZATION_CONFIG } from "@/app/lib/virtualizationConfig";

export interface VirtualGridProps<T> {
  items: T[];
  /** Stable React key for an item. */
  itemKey: (item: T, index: number) => React.Key;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Fixed height of a single row (a cell plus its caption etc.), in pixels. */
  rowHeight: number;
  /** Minimum width a cell needs before another column is added. */
  minItemWidth: number;
  /** Gap between cells/rows, in pixels. Default 24 (matches `gap-6`). */
  gap?: number;
  /** Extra pixels rendered above/below the viewport. */
  overscanPx?: number;
  className?: string;
  /** ARIA role for the outer container, e.g. "list". Omit for none. */
  ariaRole?: string;
}

/**
 * Windowed replacement for `items.map(...)` inside a CSS grid: computes how
 * many columns fit the container's current width (via `ResizeObserver`),
 * then only mounts the rows near the viewport. Falls back to a single column
 * where `ResizeObserver` isn't available (e.g. very old browsers, or a
 * non-DOM test environment) rather than failing to render.
 *
 * ```tsx
 * <VirtualGrid
 *   items={clips}
 *   itemKey={(clip) => clip.id}
 *   rowHeight={280}
 *   minItemWidth={220}
 *   renderItem={(clip) => <ClipCard clip={clip} />}
 * />
 * ```
 */
export default function VirtualGrid<T>({
  items,
  itemKey,
  renderItem,
  rowHeight,
  minItemWidth,
  gap = 24,
  overscanPx = VIRTUALIZATION_CONFIG.overscanPx,
  className,
  ariaRole,
}: VirtualGridProps<T>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const computeColumns = (width: number) => {
      const next = Math.max(1, Math.floor((width + gap) / (minItemWidth + gap)));
      setColumns((prev) => (prev === next ? prev : next));
    };

    computeColumns(el.clientWidth);

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      computeColumns(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [minItemWidth, gap]);

  const { containerRef, totalHeight, virtualRows } = useWindowVirtualizer({
    count: items.length,
    columns,
    rowHeight,
    gap,
    overscanPx,
  });

  return (
    <div ref={wrapperRef} className={className}>
      <div ref={containerRef} role={ariaRole} style={{ position: "relative", height: totalHeight }}>
        {virtualRows.map(({ rowIndex, top }) => (
          <div
            key={rowIndex}
            style={{
              position: "absolute",
              top,
              left: 0,
              right: 0,
              height: rowHeight,
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap,
            }}
          >
            {Array.from({ length: columns }, (_, colIndex) => {
              const itemIndex = rowIndex * columns + colIndex;
              const item = items[itemIndex];
              if (item === undefined) return <div key={colIndex} aria-hidden="true" />;

              return <React.Fragment key={itemKey(item, itemIndex)}>{renderItem(item, itemIndex)}</React.Fragment>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
