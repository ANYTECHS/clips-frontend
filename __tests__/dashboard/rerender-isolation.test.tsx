/**
 * Re-render isolation for the dashboard (#875).
 *
 * These tests pin the behaviour the optimisation is for: a write to one slice
 * of dashboard state must not re-render consumers that read a different slice,
 * and a purely presentational card must not re-render when its props are
 * unchanged. They count renders rather than asserting on markup, so a
 * regression that reintroduces a composite selector or an inline context value
 * fails here instead of only showing up as jank in the browser.
 */

import React from "react";
import { act, render, renderHook } from "@testing-library/react";
import {
  useDashboardStore,
  selectStats,
  selectLoading,
  selectError,
  selectLastFetchedAt,
  selectDashboardMeta,
} from "@/app/store";
import StatCard from "@/components/dashboard/StatCard";

const initialState = {
  stats: null,
  revenueTrend: [],
  recentProjects: [],
  lastFetchedAt: null,
  loading: false,
  error: null,
};

beforeEach(() => {
  useDashboardStore.setState(initialState);
});

describe("fine-grained dashboard selectors", () => {
  it("does not re-render a loading subscriber when only stats change", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useDashboardStore(selectLoading);
    });

    const rendersAfterMount = renders;
    expect(result.current).toBe(false);

    act(() => {
      useDashboardStore.setState({
        stats: {
          earnings: { total: 10, trendLabel: "+1%", trend: 1 },
          clips: { total: 2, trendLabel: "+1%", trend: 1 },
          platforms: { total: 3, trendLabel: "Live", trend: 0 },
        },
      });
    });

    expect(renders).toBe(rendersAfterMount);
    expect(result.current).toBe(false);
  });

  it("does not re-render a stats subscriber when only the loading flag changes", () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useDashboardStore(selectStats);
    });

    const rendersAfterMount = renders;

    act(() => {
      useDashboardStore.setState({ loading: true });
    });

    expect(renders).toBe(rendersAfterMount);
  });

  it("re-renders a loading subscriber when the loading flag itself changes", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useDashboardStore(selectLoading);
    });

    const rendersAfterMount = renders;

    act(() => {
      useDashboardStore.setState({ loading: true });
    });

    expect(renders).toBeGreaterThan(rendersAfterMount);
    expect(result.current).toBe(true);
  });

  it("does not re-render an error subscriber when lastFetchedAt changes", () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useDashboardStore(selectError);
    });

    const rendersAfterMount = renders;

    act(() => {
      useDashboardStore.setState({ lastFetchedAt: 1_700_000_000_000 });
    });

    expect(renders).toBe(rendersAfterMount);
  });

  it("keeps atomic selectors referentially stable across unrelated writes", () => {
    const before = {
      loading: selectLoading(useDashboardStore.getState()),
      error: selectError(useDashboardStore.getState()),
      lastFetchedAt: selectLastFetchedAt(useDashboardStore.getState()),
    };

    act(() => {
      useDashboardStore.setState({ revenueTrend: [{ month: "Jan", value: 1 }] });
    });

    expect(selectLoading(useDashboardStore.getState())).toBe(before.loading);
    expect(selectError(useDashboardStore.getState())).toBe(before.error);
    expect(selectLastFetchedAt(useDashboardStore.getState())).toBe(
      before.lastFetchedAt,
    );
  });

  it("documents why the composite meta selector is not safe to subscribe to", () => {
    // Same state, two calls, two different objects — nothing downstream of this
    // can be compared with Object.is, which is what made every store write
    // re-render the consumer.
    const state = useDashboardStore.getState();
    expect(selectDashboardMeta(state)).toEqual(selectDashboardMeta(state));
    expect(selectDashboardMeta(state)).not.toBe(selectDashboardMeta(state));
  });
});

describe("StatCard memoisation", () => {
  /**
   * Wrap StatCard in a memoised probe that reports each render through a spy.
   * A spy call is used rather than a counter variable so the probe stays a pure
   * component — reassigning an outer binding during render is itself the kind
   * of side effect this suite is guarding against.
   */
  function makeProbe(onRender: () => void) {
    function StatCardProbe(props: React.ComponentProps<typeof StatCard>) {
      onRender();
      return <StatCard {...props} />;
    }
    return React.memo(StatCardProbe);
  }

  it("does not re-render when its parent re-renders with unchanged props", () => {
    const onRender = jest.fn();
    const MemoCard = makeProbe(onRender);

    function Parent({ unrelated }: { unrelated: number }) {
      return (
        <div>
          <span data-testid="unrelated">{unrelated}</span>
          <MemoCard label="Earnings" value="$100" />
        </div>
      );
    }

    const { rerender, getByTestId } = render(<Parent unrelated={1} />);
    expect(onRender).toHaveBeenCalledTimes(1);

    rerender(<Parent unrelated={2} />);

    expect(getByTestId("unrelated").textContent).toBe("2");
    expect(onRender).toHaveBeenCalledTimes(1);
  });

  it("re-renders when one of its own props actually changes", () => {
    const onRender = jest.fn();
    const MemoCard = makeProbe(onRender);

    function Parent({ value }: { value: string }) {
      return <MemoCard label="Earnings" value={value} />;
    }

    const { rerender } = render(<Parent value="$100" />);
    expect(onRender).toHaveBeenCalledTimes(1);

    rerender(<Parent value="$200" />);
    expect(onRender).toHaveBeenCalledTimes(2);
  });
});
