/**
 * @jest-environment node
 */
// In the node environment `window` is never defined, simulating SSR.
import { sanitize } from "@/app/lib/sanitize";

describe("sanitize (SSR / node)", () => {
  it("returns input unchanged on the server where window is unavailable", () => {
    expect(typeof window).toBe("undefined");
    expect(sanitize('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
  });
});
