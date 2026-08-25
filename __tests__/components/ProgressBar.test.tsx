/**
 * Tests for the compositor-friendly progress bar (#879).
 *
 * The point of the component is *how* it animates, so these assert on the
 * transform rather than only on the rendered percentage — a regression back to
 * animating `width` would pass a value-only test while reintroducing layout
 * work on every frame.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import ProgressBar, { clampPercent } from "@/components/ui/ProgressBar";

describe("clampPercent", () => {
  it.each([
    [50, 50],
    [0, 0],
    [100, 100],
    [-10, 0],
    [140, 100],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])("clamps %p to %p", (input, expected) => {
    expect(clampPercent(input as number)).toBe(expected);
  });
});

describe("ProgressBar", () => {
  it("animates with scaleX rather than width", () => {
    render(<ProgressBar value={40} />);
    const fill = screen.getByTestId("progress-bar-fill");

    expect(fill.style.transform).toBe("scaleX(0.4)");
    expect(fill.style.transformOrigin).toBe("left center");
    // Animating width is exactly the layout thrash this component removes.
    expect(fill.style.width).toBe("");
  });

  it("transitions only the transform, not every animatable property", () => {
    render(<ProgressBar value={40} />);
    const fill = screen.getByTestId("progress-bar-fill");

    expect(fill.className).toContain("transition-transform");
    expect(fill.className).not.toContain("transition-all");
  });

  it("hints the compositor so the fill gets its own layer", () => {
    render(<ProgressBar value={40} />);

    expect(screen.getByTestId("progress-bar-fill").className).toContain(
      "will-change-transform",
    );
  });

  it("exposes the value to assistive technology", () => {
    render(<ProgressBar value={40} label="Upload progress" />);
    const bar = screen.getByRole("progressbar", { name: "Upload progress" });

    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("clamps an out-of-range value in both the transform and the aria value", () => {
    const { rerender } = render(<ProgressBar value={140} />);
    expect(screen.getByTestId("progress-bar-fill").style.transform).toBe(
      "scaleX(1)",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );

    rerender(<ProgressBar value={-20} />);
    expect(screen.getByTestId("progress-bar-fill").style.transform).toBe(
      "scaleX(0)",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("applies the caller's duration", () => {
    render(<ProgressBar value={10} durationMs={700} />);

    expect(screen.getByTestId("progress-bar-fill").style.transitionDuration).toBe(
      "700ms",
    );
  });
});
