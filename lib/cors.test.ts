// Issue #1370 — CORS allowlist tests.
import { isOriginAllowed, getAllowedOrigins } from "./cors";

describe("CORS origin allowlist", () => {
  const ORIGINAL = process.env.ALLOWED_ORIGINS;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = ORIGINAL;
  });

  it("allows requests with no Origin header (non-browser clients)", () => {
    expect(isOriginAllowed(null)).toBe(true);
  });

  it("allows default production origins", () => {
    delete process.env.ALLOWED_ORIGINS;
    expect(isOriginAllowed("https://enclips.ai")).toBe(true);
    expect(isOriginAllowed("https://www.enclips.ai")).toBe(true);
  });

  it("rejects unknown origins", () => {
    delete process.env.ALLOWED_ORIGINS;
    expect(isOriginAllowed("https://evil.example.com")).toBe(false);
    expect(isOriginAllowed("http://localhost:3000")).toBe(false);
  });

  it("honours ALLOWED_ORIGINS env allowlist", () => {
    process.env.ALLOWED_ORIGINS = "https://staging.enclips.ai, https://preview.vercel.app";
    expect(getAllowedOrigins()).toEqual(["https://staging.enclips.ai", "https://preview.vercel.app"]);
    expect(isOriginAllowed("https://staging.enclips.ai")).toBe(true);
    expect(isOriginAllowed("https://enclips.ai")).toBe(false);
  });
});
