/**
 * Shared defaults for the windowed list/grid components in
 * `components/common/VirtualList.tsx` and `VirtualGrid.tsx`. Centralized so
 * every heavy-list call site tunes overscan the same way instead of picking
 * arbitrary numbers per component.
 */
export const VIRTUALIZATION_CONFIG = {
  /**
   * Extra pixels rendered above/below (or around, for a grid) the visible
   * viewport, so fast scrolling or keyboard navigation doesn't reveal a
   * flash of empty space before the next row mounts.
   */
  overscanPx: 600,
  /** Number of extra rows mounted before and after the visible range. */
  overscanItems: 5,
  /** Minimum item count before a list is considered "heavy" enough to virtualize. */
  virtualizeThreshold: 100,
  /** Stable row estimates; list content should clamp or truncate to these bounds. */
  rowHeight: {
    clips: 400,
    transactions: 112,
    activity: 92,
    notifications: 88,
  },
} as const;
