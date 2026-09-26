/**
 * app/hooks/useBulkSelection.ts
 *
 * Multi-select state for list views (Issue #1059).
 *
 * # Why selection is held as ids, not indices or objects
 *
 * The list underneath a selection moves: a filter changes, a page loads, a
 * clip finishes processing and its status flips. Holding indices means the
 * selection silently points at different rows after any of that; holding whole
 * objects means acting on a stale copy. Ids survive re-fetches, and
 * `visibleSelectedIds` narrows to what is actually on screen when a bulk
 * action fires.
 *
 * # Selection outlives the page
 *
 * Selecting across pages is deliberate — a creator tagging a campaign works
 * through several pages before acting. `selectAllVisible` therefore adds to
 * the selection rather than replacing it, and the action bar reports the total
 * so nobody is surprised by what a bulk delete covers.
 */

"use client";

import { useCallback, useMemo, useState } from "react";

export interface BulkSelection {
  /** Every selected id, including ones not on the current page. */
  selectedIds: string[];
  /** Selected ids that are present in `visibleIds`. */
  visibleSelectedIds: string[];
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Range-select from the last toggled id to `id`, as shift-click does. */
  toggleRange: (id: string, visibleIds: readonly string[]) => void;
  select: (ids: readonly string[]) => void;
  deselect: (ids: readonly string[]) => void;
  selectAllVisible: () => void;
  deselectAllVisible: () => void;
  clear: () => void;
  /** True when every visible row is selected. */
  allVisibleSelected: boolean;
  /** True when some but not all visible rows are selected. */
  someVisibleSelected: boolean;
  /** True once anything is selected — drives the action bar's visibility. */
  isActive: boolean;
}

export function useBulkSelection(visibleIds: readonly string[]): BulkSelection {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const visibleSelectedIds = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected],
  );

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const toggle = useCallback((id: string) => {
    setAnchorId(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleRange = useCallback(
    (id: string, ids: readonly string[]) => {
      const end = ids.indexOf(id);

      // No anchor yet, or the anchor has scrolled out of the current list —
      // fall back to a plain toggle rather than selecting from an arbitrary
      // starting point.
      const start = anchorId === null ? -1 : ids.indexOf(anchorId);
      if (start === -1 || end === -1) {
        toggle(id);
        return;
      }

      const [from, to] = start <= end ? [start, end] : [end, start];
      const range = ids.slice(from, to + 1);

      setSelected((prev) => {
        const next = new Set(prev);
        range.forEach((rangeId) => next.add(rangeId));
        return next;
      });
      setAnchorId(id);
    },
    [anchorId, toggle],
  );

  const select = useCallback((ids: readonly string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const deselect = useCallback((ids: readonly string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => select(visibleIds), [select, visibleIds]);
  const deselectAllVisible = useCallback(() => deselect(visibleIds), [deselect, visibleIds]);

  const clear = useCallback(() => {
    setSelected(new Set());
    setAnchorId(null);
  }, []);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleSelectedIds.length === visibleIds.length;

  return {
    selectedIds,
    visibleSelectedIds,
    selectedCount: selected.size,
    isSelected,
    toggle,
    toggleRange,
    select,
    deselect,
    selectAllVisible,
    deselectAllVisible,
    clear,
    allVisibleSelected,
    someVisibleSelected: visibleSelectedIds.length > 0 && !allVisibleSelected,
    isActive: selected.size > 0,
  };
}
