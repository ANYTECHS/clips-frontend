import { expect, test } from "@playwright/test";
import path from "node:path";
import { injectMockFreighter, signUpAndReachDashboard } from "./helpers";

const VIDEO_FIXTURE = path.join(process.cwd(), "tests", "fixtures", "test-video.mp4");
const CLIP_ID = "clip-upload-to-mint-e2e";
const TESTNET_PUBLIC_KEY = "GTEST123MOCKPUBLICKEY";

test("upload, process, preview, mint, and verify wallet trustline", async ({ page }) => {
  test.setTimeout(300_000);
  const jobId = `job_upload_to_mint_${Date.now()}`;
  let cleanupRequested = false;
  let mintRequested = false;

  await page.route("**/api/templates", (route) =>
    route.fulfill({ json: { data: { templates: [] } } }),
  );
  await page.route("**/api/upload", (route) =>
    route.fulfill({
      json: {
        data: {
          jobId,
          files: [{ jobId, url: "https://test.invalid/test-video.mp4" }],
        },
      },
    }),
  );
  await page.route(`**/api/jobs/${jobId}/stream`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ progress: 100, status: "complete", momentsFound: 1, estimatedSecondsRemaining: 0 })}\n\n`,
    }),
  );
  await page.route(`**/api/jobs/${jobId}`, (route) =>
    route.fulfill({
      json: { progress: 100, status: "complete", momentsFound: 1, estimatedSecondsRemaining: 0 },
    }),
  );
  await page.route("**/api/clips?**", (route) =>
    route.fulfill({
      json: {
        data: {
          clips: [
            {
              id: CLIP_ID,
              title: "Test highlight",
              thumbnail: "/placeholder-video.jpg",
              score: 96,
              scoreKey: "high",
              duration: "00:12",
              style: "Dynamic",
              status: "ready",
              resolution: "1080p",
              videoUrl: "https://test.invalid/test-video.mp4",
              tags: ["e2e"],
            },
          ],
          total: 1,
        },
      },
    }),
  );
  await page.route("**/api/clips/mint", async (route) => {
    mintRequested = true;
    await route.fulfill({ json: { data: { minted: 1, clipIds: [CLIP_ID] } } });
  });
  await page.route(`**/api/jobs/${jobId}`, async (route) => {
    if (route.request().method() === "DELETE") {
      cleanupRequested = true;
      await route.fulfill({ json: { deleted: true } });
      return;
    }
    await route.fulfill({
      json: { progress: 100, status: "complete", momentsFound: 1, estimatedSecondsRemaining: 0 },
    });
  });

  await signUpAndReachDashboard(page, "upload-to-mint");
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles(VIDEO_FIXTURE);
  await page.waitForURL(new RegExp(`/dashboard/processing\\?jobId=${jobId}`), { timeout: 30_000 });
  await expect(page.getByText(/100%|Processing complete|Your clips are ready/i).first()).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/dashboard/projects", { waitUntil: "networkidle" });
  await expect(page.getByText("Test highlight")).toBeVisible();
  const clipCard = page.locator('[data-tour="clip-preview"]').filter({ hasText: "Test highlight" });
  await clipCard.locator('[role="checkbox"]').click();
  await clipCard.getByRole("button", { name: "Preview clip" }).click({ force: true });
  await expect(page.getByRole("dialog", { name: "Test highlight" })).toBeVisible();
  await page.getByRole("button", { name: "Close preview" }).click();

  const mintResponse = page.waitForResponse(
    (response) => response.url().includes("/api/clips/mint") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Mint as NFT" }).click();
  await mintResponse;
  expect(mintRequested).toBe(true);

  await injectMockFreighter(page);
  await page.route(`https://horizon-testnet.stellar.org/accounts/${TESTNET_PUBLIC_KEY}`, (route) =>
    route.fulfill({
      json: {
        balances: [
          { asset_type: "native", balance: "100.0000000" },
          {
            asset_type: "credit_alphanum4",
            asset_code: "CLIP",
            asset_issuer: "GTESTNFTISSUER",
            balance: "1.0000000",
          },
        ],
      },
    }),
  );
  await page.route("**/api/prices/xlm", (route) => route.fulfill({ json: { price: 0.12 } }));
  await page.goto("/wallet", { waitUntil: "networkidle" });
  await expect(page.getByText("CLIP", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.request.delete(`/api/jobs/${jobId}`);
  const csrfResponse = await page.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
  await page.request.post("/api/auth/signout", {
    form: { csrfToken, callbackUrl: "/" },
  });
  await page.context.clearCookies();
  expect(cleanupRequested).toBe(true);
});
