import { test, expect, Page } from '@playwright/test';

async function signUpAndGoToOnboarding(page: Page, email: string) {
  await page.goto('/login');
  await page.click('text=Sign up free');
  await page.fill('#auth-name', 'Onboarding Tester');
  await page.fill('input[type="email"]', email);
  await page.fill('#auth-password', 'Password123!');
  await page.click('button:has-text("Create Account")');
  // New users land on /onboarding after signup
  await page.waitForURL(/\/onboarding/, { timeout: 8000 });
}

test.describe('3-Step Onboarding Flow', () => {
  test('happy path: complete all 3 steps and land on dashboard', async ({ page }) => {
    await signUpAndGoToOnboarding(page, `happy-${Date.now()}@example.com`);

    // --- Step 1: Profile Setup ---
    await expect(page.locator('text=Basic Information')).toBeVisible();

    await page.fill('input[name="name"]', 'Onboard User');
    await page.fill('input[name="username"]', 'onboarduser');
    await page.fill('textarea[name="bio"]', 'E2E test account for onboarding.');
    await page.selectOption('select[name="niche"]', 'gaming');

    await page.click('button:has-text("Continue to step 2")');

    // --- Step 2: Connect Socials ---
    await expect(page.locator('text=Connect your socials')).toBeVisible();

    await page.fill('input[name="tiktok"]', '@onboarduser');
    await page.fill('input[name="instagram"]', '@onboarduser');
    await page.fill('input[name="youtube"]', '@onboarduser');

    await page.click('button:has-text("Continue")');

    // --- Step 3: Wallet Awareness ---
    await expect(page.locator('text=Your payment wallet is ready!')).toBeVisible();
    await page.click('button:has-text("Go to Dashboard")');

    await page.waitForURL(/\/dashboard/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('skipping optional social handles goes straight to wallet step', async ({ page }) => {
    await signUpAndGoToOnboarding(page, `skip-${Date.now()}@example.com`);

    // Complete step 1
    await page.fill('input[name="name"]', 'Skip User');
    await page.fill('input[name="username"]', `skipuser${Date.now()}`);
    await page.selectOption('select[name="niche"]', 'podcast');
    await page.click('button:has-text("Continue to step 2")');

    // Step 2 — skip all optional social fields
    await expect(page.locator('text=Connect your socials')).toBeVisible();
    await page.click('button:has-text("Skip for now")');

    // Should land on step 3 (wallet awareness)
    await expect(page.locator('text=Your payment wallet is ready!')).toBeVisible();
  });

  test('back-navigation: step 2 back-button returns to step 1 form', async ({ page }) => {
    await signUpAndGoToOnboarding(page, `back-${Date.now()}@example.com`);

    // Complete step 1 to reach step 2
    await page.fill('input[name="name"]', 'Back User');
    await page.fill('input[name="username"]', `backuser${Date.now()}`);
    await page.selectOption('select[name="niche"]', 'vlog');
    await page.click('button:has-text("Continue to step 2")');

    await expect(page.locator('text=Connect your socials')).toBeVisible();

    // Click browser back
    await page.goBack();

    // Step 1 form should be visible again
    await expect(page.locator('text=Basic Information')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
  });

  test('step 1 validation errors appear on required fields', async ({ page }) => {
    await signUpAndGoToOnboarding(page, `validate-${Date.now()}@example.com`);

    // Try to submit step 1 without filling anything
    await page.click('button:has-text("Continue to step 2")');

    await expect(page.locator('[role="alert"]', { hasText: 'Full name is required' })).toBeVisible();
    await expect(page.locator('[role="alert"]', { hasText: 'Username is required' })).toBeVisible();
    await expect(page.locator('[role="alert"]', { hasText: 'Please select your creator niche' })).toBeVisible();

    // Fill a bad username (too short)
    await page.fill('input[name="username"]', 'ab');
    await page.locator('input[name="username"]').blur();
    await expect(page.locator('[role="alert"]', { hasText: '3-30 characters' })).toBeVisible();

    // Bio over 160 chars
    await page.fill('textarea[name="bio"]', 'x'.repeat(161));
    await page.locator('textarea[name="bio"]').blur();
    await expect(page.locator('[role="alert"]', { hasText: 'Bio cannot exceed 160 characters' })).toBeVisible();
  });

  test('step 2 shows validation error for bad social handle format', async ({ page }) => {
    await signUpAndGoToOnboarding(page, `social-validate-${Date.now()}@example.com`);

    // Complete step 1 cleanly
    await page.fill('input[name="name"]', 'Social Validator');
    await page.fill('input[name="username"]', `socialval${Date.now()}`);
    await page.selectOption('select[name="niche"]', 'educational');
    await page.click('button:has-text("Continue to step 2")');

    await expect(page.locator('text=Connect your socials')).toBeVisible();

    // Enter an invalid TikTok handle (spaces are disallowed)
    await page.fill('input[name="tiktok"]', 'invalid handle with spaces!!!');
    await page.locator('input[name="tiktok"]').blur();
    await expect(page.locator('[role="alert"]', { hasText: 'Invalid TikTok format' })).toBeVisible();
  });
});
