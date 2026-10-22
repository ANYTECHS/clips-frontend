import { test, expect } from "@playwright/test";
import { signUpAndReachDashboard } from "./helpers";

function frame(id: number, progress: number, status = "processing") {
  const data = JSON.stringify({
    progress,
    status,
    momentsFound: Math.floor(progress / 20),
    estimatedSecondsRemaining: status === "complete" ? 0 : 60,
  });
  return `id: ${id}\ndata: ${data}\n\n`;
}

test.describe("Job progress SSE reconnection (E2E)", () => {
  test("resumes from Last-Event-ID after a connection drop without missing events", async ({
    page,
  }) => {
    const jobId = `sse_e2e_${Date.now()}`;
    const streamRequests: URL[] = [];
    let releaseReconnect: () => void = () => {};
    const reconnectGate = new Promise<void>((resolve) => {
      releaseReconnect = resolve;
    });

    await page.route(`**/api/jobs/${jobId}/stream**`, async (route) => {
      const url = new URL(route.request().url());
      streamRequests.push(url);

      if (streamRequests.length === 1) {
        // First connection delivers two events, then the body ends — the
        // client sees this as a dropped connection.
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: frame(1, 20) + frame(2, 40),
        });
        return;
      }

      // Hold the reconnect open until the test has seen the indicator.
      await reconnectGate;
      const lastEventId = Number(url.searchParams.get("lastEventId"));
      // Replay what the client missed after its last event, then finish.
      const missed = [frame(3, 60), frame(4, 80), frame(5, 100, "complete")].filter(
        (_, i) => i + 3 > lastEventId
      );
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: missed.join(""),
      });
    });

    await signUpAndReachDashboard(page, "sse-reconnect");
    await page.goto(`/dashboard/processing?jobId=${jobId}`);

    await expect(page.locator("text=40%").first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("sse-reconnecting")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("sse-reconnecting")).toHaveText(/Reconnecting\.\.\./);

    releaseReconnect();

    await expect(page.locator("text=/Your clips are ready!/i")).toBeVisible({ timeout: 20000 });

    expect(streamRequests.length).toBeGreaterThanOrEqual(2);
    expect(streamRequests[0].searchParams.get("lastEventId")).toBeNull();
    expect(streamRequests[1].searchParams.get("lastEventId")).toBe("2");
  });
});
