import { test, expect } from '@playwright/test';

test.describe('Earnings Flow (E2E)', () => {
    test('navigate to earnings, assert table renders, export to CSV', async ({ page }) => {
        // Login
        await page.goto('/login');
        await page.click('text=Sign up free');
        await page.fill('#auth-name', 'Earnings E2E Tester');
        await page.fill('input[type="email"]', `earnings-${Date.now()}@example.com`);
        await page.fill('#auth-password', 'Password123!');
        await page.click('button:has-text("Create Account")');

        await expect(page).toHaveURL(/\/onboarding|\/dashboard/);
        if (page.url().includes('/onboarding')) {
            const cont = page.locator('button:has-text("Continue"), text=Continue').first();
            if (await cont.count()) await cont.click();
        }
        await expect(page).toHaveURL(/\/dashboard/);

        // Earnings page
        await page.goto('/earnings');
        await expect(page.locator('h1')).toContainText('Earnings', { timeout: 20000 });

        // Table renders
        const earningsTable = page.locator('table');
        await expect(earningsTable.first()).toBeVisible({ timeout: 20000 });

        // Export to CSV
        const exportButton = page.locator('button:has-text("Export"), a:has-text("Export")').first();
        await expect(exportButton).toBeVisible();
        await exportButton.click();

        const csvButton = page.locator('button:has-text("CSV"), a:has-text("CSV")').first();
        await expect(csvButton).toBeVisible({ timeout: 10000 });

        const downloadPromise = page.waitForEvent('download');
        await csvButton.click();

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toContain('.csv');
        expect(download.suggestedFilename()).toContain('clipcash-earnings-');
    });
});

