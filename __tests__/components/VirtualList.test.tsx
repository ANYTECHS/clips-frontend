/**
 * __tests__/components/VirtualList.test.tsx
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import VirtualList from "@/components/common/VirtualList";

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

describe("VirtualList", () => {
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(window, "innerHeight", { value: originalInnerHeight, configurable: true });
  });

  it("only mounts a windowed subset of a large item list", () => {
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    mockContainerTop(0);

    const items = Array.from({ length: 1000 }, (_, i) => ({ id: `item-${i}` }));

    render(
      <VirtualList
        items={items}
        itemKey={(item) => item.id}
        rowHeight={50}
        renderItem={(item) => <div data-testid="row">{item.id}</div>}
      />,
    );

    const rendered = screen.getAllByTestId("row");
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(items.length);
    expect(screen.getByText("item-0")).toBeInTheDocument();
  });

  it("sizes the container to the full (non-virtualized) list height", () => {
    mockContainerTop(0);
    const items = Array.from({ length: 40 }, (_, i) => ({ id: `item-${i}` }));

    const { container } = render(
      <VirtualList
        items={items}
        itemKey={(item) => item.id}
        rowHeight={50}
        gap={10}
        renderItem={(item) => <div>{item.id}</div>}
      />,
    );

    const root = container.firstElementChild as HTMLElement;
    // 40 rows * (50 + 10) - 10 trailing gap
    expect(root.style.height).toBe(`${40 * 60 - 10}px`);
  });

  it("renders nothing extra for an empty item list", () => {
    mockContainerTop(0);
    render(<VirtualList items={[]} itemKey={(item: { id: string }) => item.id} rowHeight={50} renderItem={() => null} />);

    expect(screen.queryAllByTestId("row")).toHaveLength(0);
  });
});
