import { render } from "@testing-library/react";
import DnsPrefetchHints from "@/components/DnsPrefetchHints";
import {
  DICEBEAR_ORIGIN,
  EXCLUDED_DNS_PREFETCH_ORIGINS,
} from "@/app/lib/dnsPrefetchOrigins";
import { renderToStaticMarkup } from "react-dom/server";

describe("DnsPrefetchHints", () => {
  it("renders dns-prefetch links for configured origins", () => {
    const { container } = render(<DnsPrefetchHints />);
    const links = container.querySelectorAll('link[rel="dns-prefetch"]');

    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", DICEBEAR_ORIGIN);
  });

  it("does not emit preconnect, preload, or excluded origins", () => {
    const { container } = render(<DnsPrefetchHints />);

    expect(container.querySelectorAll('link[rel="preconnect"]')).toHaveLength(0);
    expect(container.querySelectorAll('link[rel="preload"]')).toHaveLength(0);

    for (const origin of EXCLUDED_DNS_PREFETCH_ORIGINS) {
      expect(container.innerHTML).not.toContain(origin);
    }
  });

  it("renders without error during SSR", () => {
    expect(() => renderToStaticMarkup(<DnsPrefetchHints />)).not.toThrow();
    expect(renderToStaticMarkup(<DnsPrefetchHints />)).toContain('rel="dns-prefetch"');
    expect(renderToStaticMarkup(<DnsPrefetchHints />)).toContain(DICEBEAR_ORIGIN);
  });
});
