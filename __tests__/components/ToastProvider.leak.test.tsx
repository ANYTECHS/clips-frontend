/**
 * __tests__/components/ToastProvider.leak.test.tsx
 *
 * Regression test for a real leak: `addToast` scheduled a bare
 * `setTimeout` per toast with no reference kept to it, so a toast still
 * pending when `ToastProvider` unmounts left its auto-dismiss timer
 * running. `jest.getTimerCount()` makes the fix directly assertable.
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast } from "@/components/ui/ToastProvider";
import { expectNoLeakedTimers } from "../utils/leakDetection";

function Trigger() {
  const { addToast } = useToast();
  return <button onClick={() => addToast("hello", "info")}>notify</button>;
}

describe("ToastProvider auto-dismiss timers", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("clears pending auto-dismiss timers on unmount instead of leaking them", () => {
    const { unmount } = render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    const baseline = jest.getTimerCount();

    fireEvent.click(screen.getByText("notify"));
    fireEvent.click(screen.getByText("notify"));

    expect(jest.getTimerCount()).toBe(baseline + 2);

    unmount();

    expect(jest.getTimerCount()).toBe(baseline);
  });

  it("leaks no timers via the shared expectNoLeakedTimers helper", async () => {
    await expectNoLeakedTimers(
      () =>
        render(
          <ToastProvider>
            <Trigger />
          </ToastProvider>,
        ),
      () => {
        fireEvent.click(screen.getByText("notify"));
      },
    );
  });

  it("still auto-dismisses a toast normally when the provider stays mounted", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("notify"));
    expect(screen.getByText("hello")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.queryByText("hello")).not.toBeInTheDocument();
  });
});
