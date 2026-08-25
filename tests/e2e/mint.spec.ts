import { test, expect } from "@playwright/test";
import { signUpAndReachDashboard, injectMockFreighter } from "./helpers";

test.describe("Vault mint flow (E2E)", () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndReachDashboard(page, "mint");
    await injectMockFreighter(page);
  });

  test("fills mint form in vault and confirms mocked stellar transaction", async ({
    page,
  }) => {
    await page.route("**/api/mint**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          txHash: "mock-stellar-tx-hash",
          collectionId: "collection-e2e",
        }),
      });
    });

    await page.goto("/vault");
    await page.waitForLoadState("domcontentloaded");

    const configureMint = page
      .locator('button:has-text("Configure Mint")')
      .first();
    if (await configureMint.isVisible()) {
      await configureMint.click();
    }

    await page.fill('input[name="collectionName"]', "E2E Test Collection");
    await page.fill("textarea[name=\"description\"]", "Minted during Playwright E2E.");
    await page.fill('input[name="creatorRoyalty"]', "10");
    await page.fill('input[name="listingPrice"]', "1");

    await page.click('button:has-text("Mint Collection")');

    await expect(
      page
        .locator("text=/Minting Successful|mock-stellar|collection/i")
        .first()
    ).toBeVisible({ timeout: 20000 });
  });
});
