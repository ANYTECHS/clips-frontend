import { Page, expect } from "@playwright/test";

export async function signUpAndReachDashboard(page: Page, label: string) {
  const email = `${label}-${Date.now()}@example.com`;
  await page.goto("/login");
  await page.click("text=Sign up free");
  await page.fill("#auth-name", `${label} User`);
  await page.fill('input[type="email"]', email);
  await page.fill("#auth-password", "Password123!");
  await page.click('button:has-text("Create Account")');

  await expect(page).toHaveURL(/\/onboarding|\/dashboard/, { timeout: 20000 });

  if (page.url().includes("/onboarding")) {
    const cont = page
      .locator('button:has-text("Continue"), text=Continue')
      .first();
    if (await cont.count()) {
      await cont.click();
    }
  }

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
}

export async function injectMockFreighter(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { freighter: unknown }).freighter = {
      isConnected: () => Promise.resolve(true),
      getPublicKey: () => Promise.resolve("GTEST123MOCKPUBLICKEY"),
      signTransaction: () => Promise.resolve("MOCK_SIGNED_XDR"),
      getNetwork: () => Promise.resolve("TESTNET"),
    };
  });
}
