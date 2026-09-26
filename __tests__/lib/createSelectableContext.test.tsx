/**
 * __tests__/lib/createSelectableContext.test.tsx
 */

import React, { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { createSelectableContext, shallowEqual } from "@/app/lib/createSelectableContext";

interface CounterState {
  a: number;
  b: number;
}

describe("createSelectableContext", () => {
  it("re-renders a selector consumer only when its selected slice changes", () => {
    const { Provider, useSelector } = createSelectableContext<CounterState>("Counter");
    const aRenders = jest.fn();
    const bRenders = jest.fn();

    function ReadsA() {
      const a = useSelector((s) => s.a);
      aRenders();
      return <div data-testid="a">{a}</div>;
    }
    function ReadsB() {
      const b = useSelector((s) => s.b);
      bRenders();
      return <div data-testid="b">{b}</div>;
    }

    function Root() {
      const [state, setState] = useState<CounterState>({ a: 0, b: 0 });
      return (
        <Provider value={state}>
          <ReadsA />
          <ReadsB />
          <button onClick={() => setState((s) => ({ ...s, a: s.a + 1 }))}>bump a</button>
        </Provider>
      );
    }

    render(<Root />);
    expect(aRenders).toHaveBeenCalledTimes(1);
    expect(bRenders).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.click(screen.getByText("bump a"));
    });

    expect(screen.getByTestId("a").textContent).toBe("1");
    expect(aRenders).toHaveBeenCalledTimes(2);
    // `b` never changed, so its selector consumer should not re-render.
    expect(bRenders).toHaveBeenCalledTimes(1);
  });

  it("throws when useSelector is called outside its Provider", () => {
    const { useSelector } = createSelectableContext<CounterState>("Counter");
    function Bad() {
      useSelector((s) => s.a);
      return null;
    }

    const originalError = console.error;
    console.error = jest.fn();
    expect(() => render(<Bad />)).toThrow(/must be used within its matching Provider/);
    console.error = originalError;
  });
});

describe("shallowEqual", () => {
  it("returns true for objects with the same own keys/values", () => {
    expect(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
  });

  it("returns false when a value differs", () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("returns false when key counts differ", () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("short-circuits true for the same reference", () => {
    const obj = { a: 1 };
    expect(shallowEqual(obj, obj)).toBe(true);
  });
});
