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
  /** Minimum item count before a list is considered "heavy" enough to virtualize. */
  virtualizeThreshold: 30,
} as const;
