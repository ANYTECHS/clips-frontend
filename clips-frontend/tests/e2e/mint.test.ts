import { test, expect } from '@playwright/test';

test.describe('Minting Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Quick login
    await page.goto('/login');
    await page.click('text=Sign up free');
    await page.fill('#auth-name', 'Mint User');
    await page.fill('input[type="email"]', 'mint@example.com');
    await page.fill('#auth-password', 'password123');
    await page.click('button:has-text("Create Account")');
  });

  test('user can select clips and see selection footer', async ({ page }) => {
    await page.goto('/projects');
    
    // Select first clip
    // Clips are in a grid, let's find the first one and click its selection area or the clip itself
    const firstClip = page.locator('.group.relative').first();
    await firstClip.click();

    // Selection footer should appear
    const footer = page.locator('text=Clips selected');
    await expect(footer).toBeVisible();
    await expect(page.locator('.bg-brand.w-10.h-10')).toHaveText('1');

    // Select another
    await page.locator('.group.relative').nth(1).click();
    await expect(page.locator('.bg-brand.w-10.h-10')).toHaveText('2');
  });

  test('user can open mint configuration in vault', async ({ page }) => {
    await page.goto('/vault');
    
    // Open Mint Configuration panel
    const configButton = page.locator('button:has-text("Configure Mint")').or(page.locator('h3:has-text("Mint Configuration") + button'));
    await configButton.click();

    // Verify form fields
    await expect(page.locator('label:has-text("Collection Name")')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. Summer Highlights 2024"]')).toBeVisible();
    
    // Fill form
    await page.fill('input[placeholder="e.g. Summer Highlights 2024"]', 'My Awesome Collection');
    await page.fill('textarea', 'Collection description');
    
    // Submit (mocked in API)
    await page.click('button:has-text("Mint Now")');
    
    // Verify processing state or success if any UI feedback exists
    // In VaultPage, it just logs to console, but we can verify the button state if it changes
    // Wait for the mock delay (1800ms)
    // Actually, the button says "Minting..." while loading
    // await expect(page.locator('button:has-text("Minting...")')).toBeVisible();
  });
});
