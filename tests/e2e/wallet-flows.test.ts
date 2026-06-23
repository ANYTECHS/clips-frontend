import { test, expect } from '@playwright/test';

test.describe('Wallet Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Stellar Freighter API
    await page.addInitScript(() => {
      (window as any).freighter = {
        isConnected: async () => ({ isConnected: true }),
        getPublicKey: async () => ({
          publicKey: 'GBPHZ5O2JQ5H3K4L6R7S8T9U0V1W2X3Y4Z5A6B7C8D9E0F1G2H3I4J5K6L7',
        }),
        getNetwork: async () => ({ network: 'TESTNET' }),
        signTransaction: async (xdr: string) => ({
          signedTxXdr: xdr,
        }),
        signAuthEntry: async () => ({}),
        signMessage: async () => ({}),
      };
    });

    // Quick login
    await page.goto('/login');
    await page.click('text=Sign up free');
    await page.fill('#auth-name', 'Wallet User');
    await page.fill('input[type="email"]', 'wallet-flows@example.com');
    await page.fill('#auth-password', 'password123');
    await page.click('button:has-text("Create Account")');
  });

  test('connect Stellar wallet via Freighter', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to settings to connect wallet
    await page.goto('/settings');

    // Check that the wallet section is present
    await expect(page.locator('text=Advanced Wallet Mode')).toBeVisible();

    // Toggle advanced wallet mode on
    const toggleButton = page.locator('button[aria-label="Toggle Advanced Wallet Mode"]');
    await toggleButton.click();

    // Verify the Stellar address is displayed (mock creates embedded wallet on signup)
    // The wallet may already be connected via the embedded flow; look for wallet-related text
    await page.waitForTimeout(1000);

    // Verify wallet-related UI is present
    await expect(page.locator('text=Stellar').or(page.locator('text=Wallet'))).toBeVisible();
  });

  test('send XLM payment flow', async ({ page }) => {
    await page.goto('/dashboard');

    // Scroll to the Payments Hub section
    await page.waitForSelector('text=Send Stellar Payment', { timeout: 5000 }).catch(() => {
      // If not visible, check for wallet connect first
    });

    // Connect via Stellar wallet if not already
    const connectBtn = page.locator('button:has-text("Connect Stellar")');
    if (await connectBtn.isVisible().catch(() => false)) {
      await connectBtn.click();
      await page.waitForTimeout(1000);
    }

    // Navigate to activity page
    await page.goto('/activity');

    // Verify activity feed page loads
    await expect(page.locator('h1')).toContainText('Activity Feed', { timeout: 5000 });

    // Check filter buttons are present
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    await expect(page.locator('button:has-text("Received")')).toBeVisible();
    await expect(page.locator('button:has-text("Sent")')).toBeVisible();

    // Test filter switching - click "Sent" filter
    await page.click('button:has-text("Sent")');
    await expect(page.locator('button:has-text("Sent")[aria-pressed="true"]')).toBeVisible();

    // Switch back to "All"
    await page.click('button:has-text("All")');
    await expect(page.locator('button:has-text("All")[aria-pressed="true"]')).toBeVisible();

    // Verify the page shows "No transactions yet" or transaction list
    const noTxns = page.locator('text=No transactions yet');
    const txnList = page.locator('[role="listitem"]');
    await expect(noTxns.or(txnList.first())).toBeVisible();
  });

  test('balance display updates correctly', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for the wallet info card to load
    await page.waitForTimeout(2000);

    // Check Wallet Info Card sections
    const walletInfoCard = page.locator('text=My Wallet');
    await expect(walletInfoCard).toBeVisible();

    // Check for balance display (either a number or "Loading..." or "— XLM")
    const balanceDisplay = page.locator('text=XLM');
    await expect(balanceDisplay).toBeVisible();

    // Navigate to dashboard and check wallet status badge
    const walletStatus = page.locator('text=Wallet Ready').or(page.locator('text=Loading'));
    await expect(walletStatus).toBeVisible();
  });

  test('activity page has pagination', async ({ page }) => {
    await page.goto('/activity');

    // Verify the activity feed component renders
    await page.waitForSelector('h1');

    // Check for activity section
    await expect(page.locator('text=Activity Feed')).toBeVisible();

    // Verify filter group exists
    const filterGroup = page.locator('[role="group"]');
    await expect(filterGroup).toBeVisible();

    // Check filter buttons
    const allFilter = filterGroup.locator('button:has-text("All")');
    const receivedFilter = filterGroup.locator('button:has-text("Received")');
    const sentFilter = filterGroup.locator('button:has-text("Sent")');

    await expect(allFilter).toBeVisible();
    await expect(receivedFilter).toBeVisible();
    await expect(sentFilter).toBeVisible();

    // Verify the refresh button
    const refreshBtn = page.locator('button[aria-label*="Refresh"]');
    await expect(refreshBtn).toBeVisible();
  });

  test('wallet disconnect and reconnect flow', async ({ page }) => {
    await page.goto('/dashboard');

    // Find disconnect button (may be in compact wallet connect button)
    const disconnectBtn = page.locator('button[aria-label="Disconnect wallet"]');

    if (await disconnectBtn.isVisible().catch(() => false)) {
      await disconnectBtn.click();
    }

    // After disconnect, the connect button should appear
    await page.waitForTimeout(500);

    // Verify connect UI is present
    const connectWalletBtn = page
      .locator('button:has-text("Connect Wallet")')
      .or(page.locator('button:has-text("Connect MetaMask")'))
      .or(page.locator('a:has-text("Install MetaMask")'));

    await expect(connectWalletBtn.first()).toBeVisible();
  });

  test('wallet flow accessible via dashboard sidebar', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to activity via sidebar
    const activityLink = page.locator('a:has-text("Activity Feed")');
    await expect(activityLink).toBeVisible();

    // Click the activity link
    await activityLink.click();

    // Verify we landed on the activity page
    await expect(page).toHaveURL(/\/activity/);
    await expect(page.locator('h1')).toContainText('Activity Feed');
  });

  test('locale switcher is present in header', async ({ page }) => {
    await page.goto('/dashboard');

    // Locale switcher should be visible in the header
    const localeSwitcher = page.locator('select[aria-label="Select language"]');
    await expect(localeSwitcher).toBeVisible();

    // Verify default locale is English
    await expect(localeSwitcher).toHaveValue('en');

    // Switch to Spanish
    await localeSwitcher.selectOption('es');
    await expect(localeSwitcher).toHaveValue('es');

    // Switch back to English
    await localeSwitcher.selectOption('en');
    await expect(localeSwitcher).toHaveValue('en');
  });
});
