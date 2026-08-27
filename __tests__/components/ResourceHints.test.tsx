import React from "react";
import { render } from "@testing-library/react";
import ResourceHints from "@/components/ResourceHints";
import { DEFERRED_PRECONNECT_ORIGINS, DICEBEAR_ORIGIN } from "@/app/lib/resourceHints";

describe("ResourceHints", () => {
  it("emits a single Dicebear preconnect for the landing critical path", () => {
    const { container } = render(<ResourceHints />);
    const links = container.querySelectorAll('link[rel="preconnect"]');

    expect(links).toHaveLength(1);
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
