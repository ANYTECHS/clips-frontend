import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('user can sign up and then log in', async ({ page }) => {
    // Go to login page
    await page.goto('/login');

    // Switch to signup mode
    await page.click('text=Sign up free');
    await expect(page.locator('h2')).toHaveText('Create an account');

    // Fill signup form
    await page.fill('#auth-name', 'Test User');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('#auth-password', 'password123');
    
    // Submit signup
    await page.click('button:has-text("Create Account")');

    // Should be redirected to dashboard (or onboarding first)
    // Based on MockApi, signup sets onboardingStep: 1
    // Let's check if it goes to onboarding or dashboard
    await expect(page).toHaveURL(/\/onboarding|\/dashboard/);
    
    // If it goes to onboarding, let's verify we can see it
    if (page.url().includes('/onboarding')) {
       await expect(page.locator('h1, h2')).toContainText(/Welcome|Profile/i);
    } else {
       await expect(page.locator('h1')).toContainText(/Welcome back/i);
    }
  });

  test('user can log in with existing credentials', async ({ page }) => {
    // We need to sign up first because state is in-memory
    await page.goto('/login');
    await page.click('text=Sign up free');
    await page.fill('#auth-name', 'Login User');
    await page.fill('input[type="email"]', 'login@example.com');
    await page.fill('#auth-password', 'password123');
    await page.click('button:has-text("Create Account")');
    
    // Logout (if there is a logout button, otherwise clear cookies/localStorage)
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Now try to login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'login@example.com');
    await page.fill('#auth-password', 'password123');
    await page.click('button:has-text("Continue with Email")');

    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText(/Welcome back/i);
  });
});
