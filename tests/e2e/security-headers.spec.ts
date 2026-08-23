import { test, expect } from "@playwright/test";

test("security headers are set on all responses", async ({ request }) => {
  const res = await request.get("/");

  const h = (name: string) => res.headers()[name.toLowerCase()];

  expect(h("x-frame-options")).toBe("DENY");
  expect(h("x-content-type-options")).toBe("nosniff");
  expect(h("referrer-policy")).toBe("strict-origin-when-cross-origin");
  expect(h("strict-transport-security")).toContain("includeSubDomains");
  expect(h("strict-transport-security")).toContain("preload");

  const isStaging = process.env.NEXT_PUBLIC_ENVIRONMENT === "staging";
  const csp =
    (isStaging
      ? h("content-security-policy-report-only")
      : h("content-security-policy")) ?? "";

  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("api.dicebear.com");
  expect(csp).toContain("images.unsplash.com");
  expect(csp).toContain("api.coingecko.com");
  expect(csp).toContain("report-uri /api/csp-report");

  if (isStaging) {
    expect(h("content-security-policy")).toBeUndefined();
  } else {
    expect(h("content-security-policy-report-only")).toBeUndefined();
  }
});
