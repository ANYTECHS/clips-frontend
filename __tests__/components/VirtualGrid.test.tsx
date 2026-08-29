/**
 * __tests__/components/VirtualGrid.test.tsx
 *
 * jsdom has no `ResizeObserver`, so the grid falls back to a single column —
 * these tests exercise that fallback path along with the windowing itself.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import VirtualGrid from "@/components/common/VirtualGrid";

function mockContainerTop(top: number) {
  jest.spyOn(HTMLDivElement.prototype, "getBoundingClientRect").mockReturnValue({
    top,
    bottom: top,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: top,
    toJSON() {},
  } as DOMRect);
}

describe("VirtualGrid", () => {
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(window, "innerHeight", { value: originalInnerHeight, configurable: true });
  });

  it("only mounts a windowed subset of a large item set", () => {
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    mockContainerTop(0);

    const items = Array.from({ length: 500 }, (_, i) => ({ id: `clip-${i}` }));

    render(
      <VirtualGrid
        items={items}
        itemKey={(item) => item.id}
        rowHeight={100}
        minItemWidth={200}
        renderItem={(item) => <div data-testid="cell">{item.id}</div>}
      />,
    );

    const rendered = screen.getAllByTestId("cell");
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(items.length);
    expect(screen.getByText("clip-0")).toBeInTheDocument();
  });

  it("does not crash without ResizeObserver and still renders items", () => {
    expect(typeof ResizeObserver).toBe("undefined");
    mockContainerTop(0);

    const items = Array.from({ length: 5 }, (_, i) => ({ id: `clip-${i}` }));

    render(
      <VirtualGrid
        items={items}
        itemKey={(item) => item.id}
        rowHeight={100}
        minItemWidth={200}
        renderItem={(item) => <div data-testid="cell">{item.id}</div>}
      />,
    );

    expect(screen.getAllByTestId("cell").length).toBeGreaterThan(0);
  });
});
