import { test, expect } from "@playwright/test";
import { DEFERRED_PRECONNECT_ORIGINS, DICEBEAR_ORIGIN } from "../../app/lib/resourceHints";

test.describe("resource hints on landing page", () => {
  test("emits Dicebear preconnect without analytics or Stellar preconnects", async ({
    page,
  }) => {
    await page.goto("/");

    const preconnectHrefs = await page
      .locator('link[rel="preconnect"]')
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute("href")).filter(Boolean),
      );

    expect(preconnectHrefs.filter((href) => href === DICEBEAR_ORIGIN)).toHaveLength(1);

    for (const origin of DEFERRED_PRECONNECT_ORIGINS) {
      expect(preconnectHrefs).not.toContain(origin);
    }
  });

  test("preloads at most one Dicebear hero avatar and avoids duplicate preloads", async ({
    page,
  }) => {
    await page.goto("/");

    const dicebearPreloads = await page
      .locator('link[rel="preload"][as="image"]')
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute("href") ?? "")
          .filter((href) => href.includes("api.dicebear.com")),
      );

    expect(dicebearPreloads.length).toBeLessThanOrEqual(1);

    const preloadUrls = await page
      .locator('link[rel="preload"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));

    const uniquePreloadUrls = new Set(preloadUrls.filter(Boolean));
    expect(uniquePreloadUrls.size).toBe(preloadUrls.filter(Boolean).length);
  });

  test("exposes signup navigation via next/link prefetch on the landing auth form", async ({
    page,
  }) => {
    await page.goto("/");

    const signupLink = page.getByRole("link", { name: "Sign up" });
    await expect(signupLink).toHaveAttribute("href", "/signup");
  });
});
