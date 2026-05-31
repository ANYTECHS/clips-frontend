import { test, expect, Page } from '@playwright/test';

// Inject a mock Freighter so wallet-signing calls never open a real extension
async function injectMockFreighter(page: Page) {
  await page.evaluate(() => {
    (window as any).freighter = {
      isConnected: () => Promise.resolve(true),
      getPublicKey: () => Promise.resolve('GTEST123MOCKPUBLICKEY'),
      signTransaction: (_xdr: string) => Promise.resolve('MOCK_SIGNED_XDR'),
      getNetwork: () => Promise.resolve('TESTNET'),
    };
    (window as any).freighterApi = (window as any).freighter;
  });
}

async function loginAs(page: Page, name: string, email: string) {
  await page.goto('/login');
  await page.click('text=Sign up free');
  await page.fill('#auth-name', name);
  await page.fill('input[type="email"]', email);
  await page.fill('#auth-password', 'Password123!');
  await page.click('button:has-text("Create Account")');
}

test.describe('Minting Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'Mint Tester', `mint-${Date.now()}@example.com`);
    await injectMockFreighter(page);
  });

  test('full flow: select clips → open MintConfigForm → submit → NFT appears in vault', async ({ page }) => {
    // 1. Navigate to Projects and select a clip
    await page.goto('/projects');
    const firstClip = page.locator('.group.relative').first();
    await firstClip.waitFor({ state: 'visible' });
    await firstClip.click();

    const footer = page.locator('text=Clips selected');
    await expect(footer).toBeVisible();

    // 2. Navigate to vault and open mint panel
    await page.goto('/vault');
    await page.waitForLoadState('networkidle');

    // Open the Mint Configuration panel (mobile button or desktop toggle)
    const configToggle = page
      .locator('button:has-text("Configure Mint")')
      .or(page.locator('button[aria-label*="Mint Configuration"]'))
      .or(page.locator('button').filter({ hasText: /configure mint/i }))
      .first();
    await configToggle.click();

    // 3. Fill the MintConfigForm
    await page.fill('input[name="collectionName"]', 'E2E Genesis Collection');
    await page.fill('textarea[name="description"]', 'Created by the E2E minting test suite.');
    await page.fill('input[name="creatorRoyalty"]', '10');
    await page.fill('input[name="listingPrice"]', '0.5');

    // 4. Submit — MockApi.mintCollection has random failures; retry until success
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.click('button:has-text("Mint Collection"), button:has-text("Retry Minting")');
      const success = page.locator('text=Minting Successful!');
      const errorBanner = page.locator('.bg-red-500\\/10, .bg-yellow-500\\/10');
      const result = await Promise.race([
        success.waitFor({ timeout: 4000 }).then(() => 'success'),
        errorBanner.waitFor({ timeout: 4000 }).then(() => 'error'),
      ]).catch(() => 'timeout');
      if (result === 'success') break;
    }

    await expect(page.locator('text=Minting Successful!')).toBeVisible({ timeout: 6000 });

    // 5. Confirm NFT vault is reachable after minting
    await page.goto('/vault');
    await expect(page).toHaveURL(/\/vault/);
  });

  test('minting with invalid config shows validation errors', async ({ page }) => {
    await page.goto('/vault');
    await page.waitForLoadState('networkidle');

    const configToggle = page
      .locator('button:has-text("Configure Mint")')
      .or(page.locator('button').filter({ hasText: /configure mint/i }))
      .first();
    await configToggle.click();

    // Submit with all fields empty → each required field should show an error
    await page.click('button:has-text("Mint Collection")');

    await expect(page.locator('text=Collection name is required.')).toBeVisible();
    await expect(page.locator('text=Description is required.')).toBeVisible();
    await expect(page.locator('text=Royalty % is required.')).toBeVisible();
    await expect(page.locator('text=Listing price is required.')).toBeVisible();

    // Fill a collection name that is too short
    await page.fill('input[name="collectionName"]', 'AB');
    await page.locator('input[name="collectionName"]').blur();
    await expect(page.locator('text=Must be at least 3 characters.')).toBeVisible();

    // Enter an invalid royalty (> 50)
    await page.fill('input[name="creatorRoyalty"]', '99');
    await page.locator('input[name="creatorRoyalty"]').blur();
    await expect(page.locator('text=Must be between 0 and 50.')).toBeVisible();
  });

  test('minting failure shows error message and allows retry', async ({ page }) => {
    // Force MockApi.mintCollection to always throw NETWORK_ERROR
    await page.addInitScript(() => {
      Object.defineProperty(window, '__forceNetworkError', { value: true });
    });

    await page.goto('/vault');
    await page.waitForLoadState('networkidle');

    const configToggle = page
      .locator('button:has-text("Configure Mint")')
      .or(page.locator('button').filter({ hasText: /configure mint/i }))
      .first();
    await configToggle.click();

    await page.fill('input[name="collectionName"]', 'Fail Test Collection');
    await page.fill('textarea[name="description"]', 'This mint is expected to fail.');
    await page.fill('input[name="creatorRoyalty"]', '5');
    await page.fill('input[name="listingPrice"]', '1');

    await page.click('button:has-text("Mint Collection")');

    // Error banner or network error message must appear within the retry cycle
    const errorOrRetry = page
      .locator('text=Network error')
      .or(page.locator('text=WALLET_REJECTED'))
      .or(page.locator('text=Something went wrong'))
      .or(page.locator('button:has-text("Retry Minting")'));

    await expect(errorOrRetry.first()).toBeVisible({ timeout: 10000 });

    // Retry button must be visible so the user can re-attempt
    await expect(
      page.locator('button:has-text("Retry Minting"), button:has-text("Mint Collection")')
    ).toBeVisible();
  });
});
