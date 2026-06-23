import { test, expect } from '@playwright/test';

test.describe('Earnings Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Quick login
    await page.goto('/login');
    await page.click('text=Sign up free');
    await page.fill('#auth-name', 'Earnings User');
    await page.fill('input[type="email"]', 'earnings@example.com');
    await page.fill('#auth-password', 'password123');
    await page.click('button:has-text("Create Account")');
  });

  test('user can view earnings and export CSV', async ({ page }) => {
    await page.goto('/earnings');

    // Wait for data to load (MockApi delay is ~1000ms)
    await expect(page.locator('h1')).toContainText('Earnings & Tax Report', { timeout: 5000 });

    // Verify summary stats
    await expect(page.locator('text=Total Earned')).toBeVisible();

    // Open export menu
    await page.click('button:has-text("Export")');
    
    // Check for CSV option
    const csvButton = page.locator('button:has-text("CSV")');
    await expect(csvButton).toBeVisible();

    // Trigger download
    const downloadPromise = page.waitForEvent('download');
    await csvButton.click();
    const download = await downloadPromise;
    
    // Verify filename
    expect(download.suggestedFilename()).toContain('clipcash-earnings-');
    expect(download.suggestedFilename()).toContain('.csv');
  });
});
