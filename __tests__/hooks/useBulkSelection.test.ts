/**
 * Tests for multi-select state (Issue #1059).
 */

import { act, renderHook } from "@testing-library/react";

import { useBulkSelection } from "@/app/hooks/useBulkSelection";

const PAGE_ONE = ["a", "b", "c", "d"];

describe("useBulkSelection", () => {
  it("starts empty and inactive", () => {
    const { result } = renderHook(() => useBulkSelection(PAGE_ONE));

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isActive).toBe(false);
  });

  it("toggles an id on and off", () => {
    const { result } = renderHook(() => useBulkSelection(PAGE_ONE));

    act(() => result.current.toggle("b"));
    expect(result.current.isSelected("b")).toBe(true);
    expect(result.current.selectedCount).toBe(1);

    act(() => result.current.toggle("b"));
    expect(result.current.isSelected("b")).toBe(false);
  });

  it("selects a contiguous range from the last toggled id", () => {
    const { result } = renderHook(() => useBulkSelection(PAGE_ONE));

    act(() => result.current.toggle("a"));
    act(() => result.current.toggleRange("c", PAGE_ONE));

    expect(result.current.selectedIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("selects a range backwards too", () => {
    const { result } = renderHook(() => useBulkSelection(PAGE_ONE));

    act(() => result.current.toggle("d"));
    act(() => result.current.toggleRange("b", PAGE_ONE));

    expect(result.current.selectedIds.sort()).toEqual(["b", "c", "d"]);
  });

  it("falls back to a plain toggle when there is no anchor", () => {
    // Shift-clicking as the very first interaction has no starting point;
    // selecting from an arbitrary one would be worse than selecting one row.
    const { result } = renderHook(() => useBulkSelection(PAGE_ONE));

    act(() => result.current.toggleRange("c", PAGE_ONE));

    expect(result.current.selectedIds).toEqual(["c"]);
  });

  it("keeps a selection that scrolls off the current page", () => {
    // The selection deliberately spans pages — a creator tagging a campaign
    // works through several before acting.
    const { result, rerender } = renderHook(
      ({ ids }) => useBulkSelection(ids),
      { initialProps: { ids: PAGE_ONE } },
    );

    act(() => result.current.toggle("a"));
    act(() => result.current.toggle("b"));

    rerender({ ids: ["e", "f"] });

    expect(result.current.selectedCount).toBe(2);
    expect(result.current.visibleSelectedIds).toEqual([]);
  });

  it("narrows visibleSelectedIds to the current page", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useBulkSelection(ids),
      { initialProps: { ids: PAGE_ONE } },
    );

    act(() => result.current.select(["a", "z"]));
    rerender({ ids: PAGE_ONE });

    expect(result.current.selectedCount).toBe(2);
    expect(result.current.visibleSelectedIds).toEqual(["a"]);
  });

  it("adds to the selection when selecting all visible, rather than replacing", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useBulkSelection(ids),
      { initialProps: { ids: PAGE_ONE } },
    );

    act(() => result.current.toggle("a"));
    rerender({ ids: ["e", "f"] });
    act(() => result.current.selectAllVisible());

    expect(result.current.selectedIds.sort()).toEqual(["a", "e", "f"]);
  });

  it("deselects only the visible rows", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useBulkSelection(ids),
      { initialProps: { ids: PAGE_ONE } },
    );

    act(() => result.current.select(["a", "b", "z"]));
    rerender({ ids: PAGE_ONE });
    act(() => result.current.deselectAllVisible());

    expect(result.current.selectedIds).toEqual(["z"]);
  });

  it("reports all/some visible selection state for a tri-state checkbox", () => {
    const { result } = renderHook(() => useBulkSelection(PAGE_ONE));

    act(() => result.current.toggle("a"));
    expect(result.current.someVisibleSelected).toBe(true);
    expect(result.current.allVisibleSelected).toBe(false);

    act(() => result.current.selectAllVisible());
    expect(result.current.allVisibleSelected).toBe(true);
    expect(result.current.someVisibleSelected).toBe(false);
  });

  it("clears everything, including off-page ids", () => {
    const { result } = renderHook(() => useBulkSelection(PAGE_ONE));

    act(() => result.current.select(["a", "z"]));
    act(() => result.current.clear());

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isActive).toBe(false);
  });
});
