import { test, expect } from '@playwright/test';

test.describe('Wallet Connection', () => {
  test.beforeEach(async ({ page }) => {
    // Mock window.ethereum before navigation
    await page.addInitScript(() => {
      (window as any).ethereum = {
        isMetaMask: true,
        request: async (args: { method: string }) => {
          if (args.method === 'eth_requestAccounts') {
            return ['0x1234567890abcdef1234567890abcdef12345678'];
          }
          if (args.method === 'eth_accounts') {
            return ['0x1234567890abcdef1234567890abcdef12345678'];
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
    });

    // Quick login
    await page.goto('/login');
    await page.click('text=Sign up free');
    await page.fill('#auth-name', 'Wallet User');
    await page.fill('input[type="email"]', 'wallet@example.com');
    await page.fill('#auth-password', 'password123');
    await page.click('button:has-text("Create Account")');
  });

  test('user can connect wallet', async ({ page }) => {
    await page.goto('/dashboard');

    // Click Connect Wallet
    const connectButton = page.locator('button:has-text("Connect Wallet")');
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    // Verify address is displayed (truncated)
    await expect(page.locator('text=0x1234...5678')).toBeVisible();
    
    // Disconnect
    await page.click('button[title="Disconnect wallet"]');
    await expect(page.locator('button:has-text("Connect Wallet")')).toBeVisible();
  });
});
