import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 * 
 * Captures and monitors visual changes across key user flows
 */

test.describe('Visual Regression - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
  });

  test('should match dashboard layout snapshot', async ({ page }) => {
    // Wait for critical content to load
    await page.waitForSelector('[data-testid="dashboard-header"]', { timeout: 5000 }).catch(() => {});
    
    // Capture full page screenshot
    await expect(page).toHaveScreenshot('dashboard-full.png', {
      fullPage: true,
      mask: [
        // Mask dynamic content that changes between runs
        page.locator('[data-testid="last-updated"]'),
        page.locator('[data-testid="user-avatar"]'),
      ],
    });
  });

  test('should match dashboard cards snapshot', async ({ page }) => {
    // Wait for cards to render
    await page.waitForSelector('[data-testid="stats-card"]', { timeout: 5000 }).catch(() => {});
    
    const cards = page.locator('[data-testid="stats-card"]');
    await expect(cards.first()).toHaveScreenshot('dashboard-card.png');
  });

  test('should match navigation snapshot', async ({ page }) => {
    const nav = page.locator('[data-testid="sidebar-navigation"]');
    await expect(nav).toHaveScreenshot('dashboard-navigation.png');
  });
});

test.describe('Visual Regression - Projects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/projects', { waitUntil: 'networkidle' });
  });

  test('should match projects list snapshot', async ({ page }) => {
    await page.waitForSelector('[data-testid="project-list"]', { timeout: 5000 }).catch(() => {});
    
    await expect(page).toHaveScreenshot('projects-list.png', {
      fullPage: true,
    });
  });

  test('should match project card snapshot', async ({ page }) => {
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 5000 }).catch(() => {});
    
    const card = page.locator('[data-testid="project-card"]').first();
    await expect(card).toHaveScreenshot('project-card.png');
  });
});

test.describe('Visual Regression - Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/analytics', { waitUntil: 'networkidle' });
  });

  test('should match analytics page snapshot', async ({ page }) => {
    await page.waitForSelector('[data-testid="analytics-container"]', { timeout: 5000 }).catch(() => {});
    
    await expect(page).toHaveScreenshot('analytics-page.png', {
      fullPage: true,
      mask: [
        // Mask charts which may render differently
        page.locator('[data-testid="chart-container"]'),
        page.locator('[data-testid="real-time-data"]'),
      ],
    });
  });

  test('should match charts snapshot', async ({ page }) => {
    await page.waitForSelector('[data-testid="chart-container"]', { timeout: 5000 }).catch(() => {});
    
    const chart = page.locator('[data-testid="chart-container"]').first();
    await expect(chart).toHaveScreenshot('analytics-chart.png');
  });
});

test.describe('Visual Regression - Clips', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/clips', { waitUntil: 'networkidle' });
  });

  test('should match clips grid snapshot', async ({ page }) => {
    await page.waitForSelector('[data-testid="clips-grid"]', { timeout: 5000 }).catch(() => {});
    
    await expect(page).toHaveScreenshot('clips-grid.png', {
      fullPage: true,
    });
  });

  test('should match clip thumbnail snapshot', async ({ page }) => {
    await page.waitForSelector('[data-testid="clip-thumbnail"]', { timeout: 5000 }).catch(() => {});
    
    const thumbnail = page.locator('[data-testid="clip-thumbnail"]').first();
    await expect(thumbnail).toHaveScreenshot('clip-thumbnail.png');
  });
});

test.describe('Visual Regression - Responsive Design', () => {
  test('should match mobile dashboard snapshot', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="dashboard-header"]', { timeout: 5000 }).catch(() => {});
    
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
    });
  });

  test('should match tablet dashboard snapshot', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="dashboard-header"]', { timeout: 5000 }).catch(() => {});
    
    await expect(page).toHaveScreenshot('dashboard-tablet.png', {
      fullPage: true,
    });
  });
});
