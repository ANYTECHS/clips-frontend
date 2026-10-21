/**
 * E2E — Security headers
 *
 * Verifies that every required security header is present and correctly
 * valued on normal page responses, and that /api/health is intentionally
 * excluded from the header set.
 *
 * These tests run against a real Next.js server (started by playwright.config.ts
 * via `next dev` / `next start`).  They do NOT skip middleware, so the
 * assertions reflect what a browser actually receives.
 *
 * HSTS note: the test server runs on http://localhost, so Strict-Transport-
 * Security is expected to be absent on the dev server.  A separate assertion
 * block documents what production deployments must emit.
 */

import { test, expect } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the lowercase header value or undefined. */
function h(headers: Record<string, string>, name: string): string | undefined {
  return headers[name.toLowerCase()];
}

// ─── Always-present headers (verified on every page response) ─────────────────

test.describe("security headers on a normal page response", () => {
  test("X-Content-Type-Options is nosniff", async ({ request }) => {
    const res = await request.get("/");
    expect(h(res.headers(), "x-content-type-options")).toBe("nosniff");
  });

  test("X-Frame-Options is DENY", async ({ request }) => {
    const res = await request.get("/");
    expect(h(res.headers(), "x-frame-options")).toBe("DENY");
  });

  test("Referrer-Policy is strict-origin-when-cross-origin", async ({ request }) => {
    const res = await request.get("/");
    expect(h(res.headers(), "referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  test("Permissions-Policy restricts camera, microphone, geolocation and payment", async ({
    request,
  }) => {
    const res = await request.get("/");
    const policy = h(res.headers(), "permissions-policy") ?? "";
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
    expect(policy).toContain("payment=()");
  });

  test("Cross-Origin-Opener-Policy is same-origin", async ({ request }) => {
    const res = await request.get("/");
    expect(h(res.headers(), "cross-origin-opener-policy")).toBe("same-origin");
  });

  test("Cross-Origin-Resource-Policy is same-origin", async ({ request }) => {
    const res = await request.get("/");
    expect(h(res.headers(), "cross-origin-resource-policy")).toBe("same-origin");
  });

  test("X-DNS-Prefetch-Control is off", async ({ request }) => {
    const res = await request.get("/");
    expect(h(res.headers(), "x-dns-prefetch-control")).toBe("off");
  });

  test("Content-Security-Policy contains required directives", async ({ request }) => {
    const res = await request.get("/");
    const isStaging = process.env.NEXT_PUBLIC_ENVIRONMENT === "staging";
    const csp =
      (isStaging
        ? h(res.headers(), "content-security-policy-report-only")
        : h(res.headers(), "content-security-policy")) ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("api.dicebear.com");
    expect(csp).toContain("images.unsplash.com");
    expect(csp).toContain("api.coingecko.com");
    expect(csp).toContain("report-uri /api/csp-report");

    // Staging uses report-only; all other environments enforce.
    if (isStaging) {
      expect(h(res.headers(), "content-security-policy")).toBeUndefined();
    } else {
      expect(
        h(res.headers(), "content-security-policy-report-only"),
      ).toBeUndefined();
    }
  });
});

// ─── HSTS ─────────────────────────────────────────────────────────────────────

test.describe("Strict-Transport-Security", () => {
  test("is absent on plaintext HTTP (localhost dev server)", async ({ request }) => {
    // The Playwright test server runs on http://localhost — middleware must NOT
    // set HSTS on plain HTTP to avoid permanently locking the browser to a
    // hostname that has no valid TLS certificate.
    const res = await request.get("/");
    const hsts = h(res.headers(), "strict-transport-security");

    // If the test is running against an https:// baseURL (e.g. a staging
    // deployment) HSTS must be present and correctly valued instead.
    const baseUrl: string = (request as unknown as { _options?: { baseURL?: string } })._options?.baseURL
      ?? process.env.BASE_URL
      ?? "http://localhost:3000";

    if (baseUrl.startsWith("https://")) {
      // Production / staging HTTPS assertion
      expect(hsts).toBeDefined();
      expect(hsts).toContain("max-age=63072000");
      expect(hsts).toContain("includeSubDomains");
      expect(hsts).toContain("preload");
    } else {
      // Local HTTP dev server — HSTS must not be set
      expect(hsts).toBeUndefined();
    }
  });
});

// ─── Headers are set on authenticated redirect responses ──────────────────────

test("security headers are present on middleware redirect responses", async ({
  request,
}) => {
  // /dashboard requires authentication — the middleware will issue a 307
  // redirect to /login.  Security headers must be stamped on the redirect too.
  const res = await request.get("/dashboard", { maxRedirects: 0 });

  // The response will be a redirect (3xx).
  expect(res.status()).toBeGreaterThanOrEqual(300);
  expect(res.status()).toBeLessThan(400);

  // Headers must be present even on redirect responses.
  expect(h(res.headers(), "x-content-type-options")).toBe("nosniff");
  expect(h(res.headers(), "x-frame-options")).toBe("DENY");
  expect(h(res.headers(), "referrer-policy")).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(h(res.headers(), "permissions-policy")).toContain("camera=()");
});

// ─── /api/health is excluded from security headers ───────────────────────────

test("/api/health does not have security headers", async ({ request }) => {
  const res = await request.get("/api/health");

  // The health endpoint must remain header-free for monitoring agents.
  // We assert the sentinel headers are absent; other headers (Content-Type,
  // Cache-Control) are irrelevant to this test.
  expect(h(res.headers(), "x-content-type-options")).toBeUndefined();
  expect(h(res.headers(), "x-frame-options")).toBeUndefined();
  expect(h(res.headers(), "permissions-policy")).toBeUndefined();
  expect(h(res.headers(), "strict-transport-security")).toBeUndefined();
});
