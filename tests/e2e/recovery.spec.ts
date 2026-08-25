import { test, expect } from "@playwright/test";

const VALID_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

test.describe("Wallet recovery (E2E)", () => {
  test("accepts a valid mnemonic and redirects to dashboard", async ({ page }) => {
    await page.goto("/recovery");

    await page.fill("#mnemonic", VALID_MNEMONIC);

    await page.click('button:has-text("Recover Wallet")');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
  });
});
