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
    test('Apple OAuth creates a local user and establishes a session', async ({ page }) => {
        let appleSignInStarted = false;
        let appleCallbackReached = false;
        let sessionEstablished = false;

        await page.route('**/api/auth/providers', (route) =>
            {
                const origin = new URL(route.request().url()).origin;
                return route.fulfill({
                    json: {
                        apple: {
                            id: 'apple',
                            name: 'Apple',
                            type: 'oauth',
                            signinUrl: `${origin}/api/auth/signin/apple`,
                            callbackUrl: `${origin}/api/auth/callback/apple`,
                        },
                    },
                });
            }
        );
        await page.route('**/api/auth/csrf', (route) =>
            route.fulfill({ json: { csrfToken: 'mock-csrf-token' } })
        );
        await page.route('**/api/auth/signin/apple', async (route) => {
            appleSignInStarted = true;
            const origin = new URL(route.request().url()).origin;
            await route.fulfill({
                json: {
                    url: `https://appleid.apple.com/auth/authorize?redirect_uri=${encodeURIComponent(`${origin}/api/auth/callback/apple`)}`,
                },
            });
        });
        await page.route('https://appleid.apple.com/auth/authorize**', async (route) => {
            const authorizeUrl = new URL(route.request().url());
            const callbackUrl = authorizeUrl.searchParams.get('redirect_uri');
            expect(callbackUrl).toBe(`${new URL(page.url()).origin}/api/auth/callback/apple`);
            if (!callbackUrl) {
                await route.fulfill({ status: 400, body: 'Missing callback URL' });
                return;
            }
            await route.fulfill({
                status: 302,
                headers: { location: `${callbackUrl}?code=mock-apple-code&state=mock-state` },
            });
        });
        await page.route('**/api/auth/callback/apple**', async (route) => {
            appleCallbackReached = true;
            await route.fulfill({ status: 302, headers: { location: '/login?apple=success' } });
        });
        await page.route('**/api/auth/session', async (route) => {
            sessionEstablished = appleCallbackReached;
            await route.fulfill({
                json: appleCallbackReached
                    ? {
                          user: {
                              id: 'apple-user-123',
                              name: 'Apple E2E User',
                              email: 'apple-e2e@example.com',
                          },
                          expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                      }
                    : null,
            });
        });

        await page.goto('/login');
        await page.getByRole('button', { name: 'Apple' }).click();

        await expect.poll(() => appleSignInStarted).toBe(true);
        await expect.poll(() => appleCallbackReached).toBe(true);
        await expect(page).toHaveURL(/\/login\?apple=success/);
        await expect.poll(() => sessionEstablished).toBe(true);
        await expect
            .poll(() => page.evaluate(() => Boolean(localStorage.getItem('clipcash_user'))))
            .toBe(true);
    });

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

