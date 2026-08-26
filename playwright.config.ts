import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  snapshotPathTemplate: '{testDir}/../visual-baselines/{arg}{ext}',
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: process.env.CI
    ? [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ]
    : [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },

        {
          name: "firefox",
          use: { ...devices["Desktop Firefox"] },
        },

        {
          name: "webkit",
          use: { ...devices["Desktop Safari"] },
        },
      ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npx next dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      E2E_SKIP_MIDDLEWARE: 'true',
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? 'e2e-google-client-id',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? 'e2e-google-client-secret',
      APPLE_ID: process.env.APPLE_ID ?? 'e2e.apple.service.id',
      APPLE_TEAM_ID: process.env.APPLE_TEAM_ID ?? 'e2e-apple-team-id',
      APPLE_KEY_ID: process.env.APPLE_KEY_ID ?? 'e2e-apple-key-id',
      APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY ?? 'e2e-apple-private-key',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'e2e-nextauth-secret',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? 'https://examplePublicKey@o0.ingest.sentry.io/0',
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
      NEXT_PUBLIC_AI_API_URL: process.env.NEXT_PUBLIC_AI_API_URL ?? 'http://localhost:3000',
      AI_BACKEND_CALLBACK_SECRET: process.env.AI_BACKEND_CALLBACK_SECRET ?? 'e2e-ai-secret',
      CLOUD_STORAGE_PROVIDER: process.env.CLOUD_STORAGE_PROVIDER ?? 's3',
      CLOUD_STORAGE_BUCKET: process.env.CLOUD_STORAGE_BUCKET ?? 'e2e-bucket',
      CLOUD_STORAGE_REGION: process.env.CLOUD_STORAGE_REGION ?? 'us-east-1',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? 'e2e-key',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? 'e2e-secret',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    },
  },
});
