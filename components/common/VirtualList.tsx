"use client";

import React from "react";
import { useWindowVirtualizer } from "@/app/hooks/useWindowVirtualizer";
import { VIRTUALIZATION_CONFIG } from "@/app/lib/virtualizationConfig";

export interface VirtualListProps<T> {
  items: T[];
  /** Stable React key for an item. */
  itemKey: (item: T, index: number) => React.Key;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Fixed height of a single row, in pixels. */
  rowHeight: number;
  /** Vertical gap between rows, in pixels. Default 0. */
  gap?: number;
  /** Extra pixels rendered above/below the viewport. */
  overscanPx?: number;
  className?: string;
  /** ARIA role for the outer container, e.g. "list". Omit for none. */
  ariaRole?: string;
}

/**
 * Windowed replacement for `items.map(...)` inside a `<ul>`/`<div>`: only
 * rows near the viewport are mounted, while the container is sized to the
 * full list's height so scrolling/scrollbar behavior is unchanged. Rows are
 * fixed-height (`rowHeight`) and absolutely positioned within the container.
 *
 * ```tsx
 * <VirtualList
 *   items={transactions}
 *   itemKey={(t) => t.id}
 *   rowHeight={84}
 *   gap={8}
 *   renderItem={(t) => <TransactionRow transaction={t} />}
 * />
 * ```
 */
export default function VirtualList<T>({
  items,
  itemKey,
  renderItem,
  rowHeight,
  gap = 0,
  overscanPx = VIRTUALIZATION_CONFIG.overscanPx,
  className,
  ariaRole,
}: VirtualListProps<T>) {
  const { containerRef, totalHeight, virtualRows } = useWindowVirtualizer({
    count: items.length,
    columns: 1,
    rowHeight,
    gap,
    overscanPx,
  });

  return (
    <div
      ref={containerRef}
      className={className}
      role={ariaRole}
      style={{ position: "relative", height: totalHeight }}
    >
      {virtualRows.map(({ rowIndex, top }) => {
        const item = items[rowIndex];
        if (item === undefined) return null;

        return (
          <div key={itemKey(item, rowIndex)} style={{ position: "absolute", top, left: 0, right: 0, height: rowHeight }}>
            {renderItem(item, rowIndex)}
          </div>
        );
      })}
    </div>
  );
}
