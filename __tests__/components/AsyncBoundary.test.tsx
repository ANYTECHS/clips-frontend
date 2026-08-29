/**
 * __tests__/components/AsyncBoundary.test.tsx
 *
 * Covers AsyncBoundary's loading/error/content states plus the render-prop
 * memoization added for `errorFallback` (unnecessary-re-render fix).
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AsyncBoundary from "@/components/common/AsyncBoundary";

describe("AsyncBoundary", () => {
  it("renders the skeleton while loading", () => {
    render(
      <AsyncBoundary loading error={null} skeleton={<div>Loading skeleton</div>}>
        <div>Content</div>
      </AsyncBoundary>,
    );

    expect(screen.getByText("Loading skeleton")).toBeInTheDocument();
  });

  it("renders children once loaded without error", () => {
    render(
      <AsyncBoundary loading={false} error={null}>
        <div>Content</div>
      </AsyncBoundary>,
    );

    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders the default error card and retries", () => {
    const onRetry = jest.fn();
    render(
      <AsyncBoundary loading={false} error={new Error("boom")} onRetry={onRetry}>
        <div>Content</div>
      </AsyncBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not re-invoke errorFallback when its inputs are unchanged across re-renders", () => {
    const error = new Error("boom");
    const onRetry = () => {};
    const errorFallback = jest.fn((err: Error) => <div>Custom: {err.message}</div>);

    const Wrapper = ({ tick }: { tick: number }) => (
      <AsyncBoundary loading={false} error={error} onRetry={onRetry} errorFallback={errorFallback}>
        <div>Content {tick}</div>
      </AsyncBoundary>
    );

    const { rerender } = render(<Wrapper tick={0} />);
    expect(errorFallback).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Custom: boom")).toBeInTheDocument();

    // Re-render with the same error/onRetry identities — a fresh parent
    // render (e.g. from unrelated state elsewhere) should not re-run the
    // render prop.
    rerender(<Wrapper tick={0} />);
    expect(errorFallback).toHaveBeenCalledTimes(1);
  });

  it("re-invokes errorFallback when the error identity changes", () => {
    const onRetry = () => {};
    const errorFallback = jest.fn((err: Error) => <div>Custom: {err.message}</div>);

    const { rerender } = render(
      <AsyncBoundary loading={false} error={new Error("first")} onRetry={onRetry} errorFallback={errorFallback}>
        <div>Content</div>
      </AsyncBoundary>,
    );
    expect(errorFallback).toHaveBeenCalledTimes(1);

    rerender(
      <AsyncBoundary loading={false} error={new Error("second")} onRetry={onRetry} errorFallback={errorFallback}>
        <div>Content</div>
      </AsyncBoundary>,
    );
    expect(errorFallback).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Custom: second")).toBeInTheDocument();
  });
});
