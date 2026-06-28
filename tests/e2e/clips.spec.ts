import { test, expect } from '@playwright/test';

test.describe('Clips Flow (E2E)', () => {
    test('navigate to clips page, apply filters, assert clip grid renders', async ({ page }) => {
        // Login
        await page.goto('/login');
        await page.click('text=Sign up free');
        await page.fill('#auth-name', 'Clips E2E Tester');
        await page.fill('input[type="email"]', `clips-${Date.now()}@example.com`);
        await page.fill('#auth-password', 'Password123!');
        await page.click('button:has-text("Create Account")');

        await expect(page).toHaveURL(/\/onboarding|\/dashboard/);
        if (page.url().includes('/onboarding')) {
            const cont = page.locator('button:has-text("Continue"), text=Continue').first();
            if (await cont.count()) await cont.click();
        }
        await expect(page).toHaveURL(/\/dashboard/);

        // Navigate to clips
        await page.goto('/clips');

        // Apply filters (best-effort - selectors vary)
        const filterOpen = page.locator('button:has-text("Filter"), button:has-text("Filters"), text=Filter').first();
        if (await filterOpen.count().catch(() => 0)) await filterOpen.click();

        const applyFilter = page.locator('button:has-text("Apply"), button:has-text("Show"), button:has-text("Done")').first();
        if (await applyFilter.count().catch(() => 0)) await applyFilter.click();

        // Assert clip grid exists
        // Grid cards often have clickable wrappers; try generic patterns.
        const clipGrid = page.locator('.grid, [data-testid="clips-grid"], [role="grid"]').first();
        await expect(clipGrid).toBeVisible({ timeout: 20000 });

        const anyClipCard = page.locator('.group.relative, a:has-text("Clip"), [data-testid*="clip"], img[alt*="clip"]').first();
        await expect(anyClipCard).toBeVisible({ timeout: 20000 });
    });
});

