import { sanitize } from "@/app/lib/sanitize";

describe("sanitize", () => {
  it("returns empty string for empty input", () => {
    expect(sanitize("")).toBe("");
  });

  it("passes through plain text unchanged", () => {
    expect(sanitize("Hello world")).toBe("Hello world");
  });

  it("strips basic script tags", () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe("");
  });

  it("strips inline event handlers", () => {
    expect(sanitize('<img src=x onerror=alert(1)>')).toBe("");
  });

  it("strips SVG with event handler", () => {
    expect(sanitize('<svg onload=alert(1)></svg>')).toBe("");
  });

  it("strips javascript: href", () => {
    expect(sanitize('<a href="javascript:alert(1)">click</a>')).toBe("click");
  });

  it("strips style-based injection", () => {
    expect(sanitize('<div style="expression(alert(1))">x</div>')).toBe("x");
  });

  it("strips data URI script injection", () => {
    expect(sanitize('<iframe src="data:text/html,<script>alert(1)</script>"></iframe>')).toBe("");
  });

  // SSR behaviour is tested separately in sanitize.ssr.test.ts (node environment)
});
