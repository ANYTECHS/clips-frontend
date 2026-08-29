import React from "react";
import { render } from "@testing-library/react";
import ResourceHints from "@/components/ResourceHints";
import { DEFERRED_PRECONNECT_ORIGINS, DICEBEAR_ORIGIN } from "@/app/lib/resourceHints";

describe("ResourceHints", () => {
  it("emits the critical landing hints in priority order", () => {
    const { container } = render(<ResourceHints />);
    const links = Array.from(container.querySelectorAll("link"));

    expect(links.some((link) => link.getAttribute("href") === DICEBEAR_ORIGIN)).toBe(true);
    expect(links[0]).toHaveAttribute("rel", "preconnect");
    expect(links[0]).toHaveAttribute("href", DICEBEAR_ORIGIN);
    expect(links[0]).toHaveAttribute("crossorigin", "anonymous");
  });

  it("does not preconnect analytics or Stellar origins", () => {
    const { container } = render(<ResourceHints />);
    const hrefs = Array.from(container.querySelectorAll("link")).map((link) =>
      link.getAttribute("href"),
    );

    for (const origin of DEFERRED_PRECONNECT_ORIGINS) {
      expect(hrefs).not.toContain(origin);
    }
  });
});
