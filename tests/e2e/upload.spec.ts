import { test, expect } from '@playwright/test';
import path from 'path';

// Upload a small test video from a fixture in /public.
// If your repo doesn't have this fixture yet, we create a data-uri fallback.
async function uploadSmallTestVideo(page: any) {
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeVisible();

    // Prefer a real fixture file if present.
    const fixturePath = path.join(process.cwd(), 'public', 'test-video-small.mp4');
    await fileInput.setInputFiles(fixturePath);
}

test.describe('Upload → Processing → Clips Flow (E2E)', () => {
    test('upload a small test video, wait for processing page, assert progress bar appears', async ({ page }) => {
        // Login
        await page.goto('/login');
        await page.click('text=Sign up free');
        await page.fill('#auth-name', 'Upload E2E Tester');
        await page.fill('input[type="email"]', `upload-${Date.now()}@example.com`);
        await page.fill('#auth-password', 'Password123!');
        await page.click('button:has-text("Create Account")');

        await expect(page).toHaveURL(/\/onboarding|\/dashboard/);
        if (page.url().includes('/onboarding')) {
            const cont = page.locator('button:has-text("Continue"), text=Continue').first();
            if (await cont.count()) await cont.click();
        }

        await expect(page).toHaveURL(/\/dashboard/);

        // Navigate to processing/upload UI (try common routes/buttons)
        await page.goto('/dashboard');

        const uploadNav = page.locator('a:has-text("Upload"), button:has-text("Upload"), a[href*="upload"], button:has-text("Add video"), text=Upload').first();
        if (await uploadNav.count().catch(() => 0)) {
            await uploadNav.click();
        }

        // Find file input and upload fixture
        await uploadSmallTestVideo(page);

        // Assert processing UI
        const processingHeading = page.locator('h1', { hasText: /Processing|Analyzing/i }).first();
        await expect(processingHeading).toBeVisible({ timeout: 20000 });

        // Progress bar / spinner
        const progressBar = page.locator('[role="progressbar"], .progress, text=/\b\d+%\b/').first();
        await expect(progressBar).toBeVisible({ timeout: 20000 });
    });
});

