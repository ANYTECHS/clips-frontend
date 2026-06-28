import { test, expect, Page } from '@playwright/test';

async function loginWithEmail(page: Page, name: string, email: string) {
    await page.goto('/login');
    await page.click('text=Sign up free');

    await page.fill('#auth-name', name);
    await page.fill('input[type="email"]', email);
    await page.fill('#auth-password', 'Password123!');

    await page.click('button:has-text("Create Account")');
}

test.describe('Auth E2E', () => {
    test('login with email, redirect to dashboard, logout', async ({ page }) => {
        await loginWithEmail(page, 'Auth E2E Tester', `auth-${Date.now()}@example.com`);

        // Signup can redirect either to onboarding or directly dashboard.
        await expect(page).toHaveURL(/\/onboarding|\/dashboard/);

        // If onboarding shows up, continue to dashboard.
        const onboard = page.locator('text=Continue, button:has-text("Continue")').first();
        if (await onboard.count()) {
            if (await onboard.isVisible().catch(() => false)) {
                await onboard.click();
            }
        }

        await expect(page).toHaveURL(/\/dashboard/);

        // Logout
        const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), text=Logout').first();
        await expect(logoutButton).toBeVisible();
        await logoutButton.click();

        // Expect login page or logged-out landing.
        await expect(page).toHaveURL(/\/login/);
    });
});

