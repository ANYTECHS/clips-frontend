"use client";

import React, { useRef } from "react";
import { useSimpleVirtualizer } from "@/app/hooks/useSimpleVirtualizer";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const rowStride = rowHeight + gap;
  const { getTotalSize, getVirtualItems } = useSimpleVirtualizer({
    count: items.length,
    estimateSize: rowStride,
    overscan: Math.ceil(overscanPx / rowStride),
    containerRef,
  });

  return (
    <div
      ref={containerRef}
      className={className}
      role={ariaRole}
      style={{ position: "relative", height: Math.max(0, getTotalSize() - gap) }}
    >
      {getVirtualItems().map(({ index, start }) => {
        const item = items[index];
        if (item === undefined) return null;

        return (
          <div key={itemKey(item, index)} style={{ position: "absolute", top: start, left: 0, right: 0, height: rowHeight }}>
            {renderItem(item, index)}
          </div>
        );
      })}
    </div>
  );
}
