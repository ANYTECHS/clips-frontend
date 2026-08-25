import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { signUpAndReachDashboard } from "./helpers";

const FIXTURE_PATH = path.join(process.cwd(), "public", "test-video-small.mp4");

test.describe("Upload → Processing → Projects (E2E)", () => {
  test.beforeAll(() => {
    fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
    if (!fs.existsSync(FIXTURE_PATH)) {
      fs.writeFileSync(FIXTURE_PATH, Buffer.from("fake-mp4-test-fixture"));
    }
  });

  test("uploads a video, completes processing, and lands on projects", async ({
    page,
  }) => {
    const jobId = `job_e2e_${Date.now()}`;

    await page.route("**/api/upload**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobId }),
      });
    });

    let progress = 0;
    await page.route(`**/api/jobs/${jobId}/stream`, async (route) => {
      progress = Math.min(100, progress + 50);
      const status = progress >= 100 ? "complete" : "processing";
      const payload = `data: ${JSON.stringify({
        progress,
        status,
        momentsFound: 3,
        estimatedSecondsRemaining: status === "complete" ? 0 : 5,
      })}\n\n`;

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: payload,
      });
    });

    await page.route(`**/api/jobs/${jobId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          progress: 100,
          status: "complete",
          momentsFound: 3,
          estimatedSecondsRemaining: 0,
        }),
      });
    });

    await signUpAndReachDashboard(page, "upload");

    await page.goto("/upload");
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_PATH);

    await page.waitForURL(/\/dashboard\/processing/, { timeout: 30000 });

    await expect(
      page.locator("text=/100%|Processing complete|Your clips are ready/i").first()
    ).toBeVisible({ timeout: 30000 });

    await page.goto("/projects");
    await expect(page).toHaveURL(/\/projects/);
  });
});
