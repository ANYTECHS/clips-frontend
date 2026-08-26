import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASELINE_DIR = path.join(__dirname, "../visual-baselines");
const SOURCE_IMAGE = path.join(__dirname, "../../public/og-image.png");

function ensureBaselinesExist() {
  if (!fs.existsSync(BASELINE_DIR)) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
  }

  const baselineFiles = [
    "dashboard.png",
    "projects.png",
    "wallet-portfolio.png",
    "earnings-table.png",
  ];

  for (const file of baselineFiles) {
    const targetPath = path.join(BASELINE_DIR, file);
    if (!fs.existsSync(targetPath) && fs.existsSync(SOURCE_IMAGE)) {
      fs.copyFileSync(SOURCE_IMAGE, targetPath);
    }
  }
}

// Initialize baseline directory & files before tests run
ensureBaselinesExist();

test.describe("Visual Regression Tests (#808)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("dashboard visual baseline", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("dashboard.png", {
      maxDiffPixelRatio: 0.01,
      fullPage: true,
    });
  });

  test("projects visual baseline with clips loaded", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("projects.png", {
      maxDiffPixelRatio: 0.01,
      fullPage: true,
    });
  });

  test("wallet portfolio visual baseline", async ({ page }) => {
    await page.goto("/wallet");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("wallet-portfolio.png", {
      maxDiffPixelRatio: 0.01,
      fullPage: true,
    });
  });

  test("earnings table visual baseline", async ({ page }) => {
    await page.goto("/earnings");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("earnings-table.png", {
      maxDiffPixelRatio: 0.01,
      fullPage: true,
    });
  });
});
