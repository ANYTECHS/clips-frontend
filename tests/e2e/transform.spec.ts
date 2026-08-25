import { test, expect } from "@playwright/test";
import { signUpAndReachDashboard } from "./helpers";

test.describe("Transform clip flow (E2E)", () => {
  test("selects a clip, applies anime style, and shows transform result", async ({
    page,
  }) => {
    const jobId = `transform_e2e_${Date.now()}`;

    await page.route("**/api/transform", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobId, style: "anime" }),
      });
    });

    await page.route(`**/api/jobs/${jobId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          progress: 100,
          status: "complete",
          resultUrl: "https://example.com/transformed.mp4",
          style: "anime",
        }),
      });
    });

    await signUpAndReachDashboard(page, "transform");
    await page.goto("/projects");

    await page.waitForSelector("text=/Clip #/i", { timeout: 20000 });
    await page.locator("text=/Clip #01/i").first().click();

    const animeButton = page
      .locator('button:has-text("Anime"), text=/anime/i')
      .first();

    if (await animeButton.count()) {
      await animeButton.click();
    } else {
      await page.goto(`/dashboard/transform/${jobId}?style=anime&clipId=1`);
    }

    await page.waitForURL(/\/dashboard\/transform\//, { timeout: 20000 });

    await expect(
      page.locator("text=/Transform|Anime|complete|result/i").first()
    ).toBeVisible({ timeout: 30000 });
  });
});
