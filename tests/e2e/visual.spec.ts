import { expect, test, type Page, type Route } from "@playwright/test";
import { signUpAndReachDashboard } from "./helpers";

const PUBLIC_ROUTES = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "explore", path: "/explore" },
];
const DASHBOARD_ROUTES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "wallet", path: "/wallet" },
  { name: "earnings", path: "/earnings" },
  { name: "settings", path: "/settings" },
  { name: "clips", path: "/clips" },
];

async function capture(page: Page, name: string, route: string) {
  await page.goto(route, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.1,
  });
}

test.describe("Visual regression pages", () => {
  test.setTimeout(300_000);

  for (const viewport of [
    { name: "desktop", width: 1280, height: 720 },
    { name: "mobile", width: 375, height: 667 },
  ]) {
    test(`captures all requested pages at ${viewport.name} size`, async ({ page }: { page: Page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.route("**/api/clips?**", (route: Route) =>
        route.fulfill({ json: { data: { clips: [], total: 0 } } }),
      );

      for (const route of PUBLIC_ROUTES) {
        await capture(page, `${route.name}-${viewport.name}`, route.path);
      }

      await signUpAndReachDashboard(page, `visual-${viewport.name}`);
      for (const route of DASHBOARD_ROUTES) {
        for (const theme of ["dark", "light"]) {
          await page.evaluate((mode: string) => {
            localStorage.setItem("clipcash-theme", mode);
            document.documentElement.setAttribute("data-theme", mode);
          }, theme);
          await capture(page, `${route.name}-${theme}-${viewport.name}`, route.path);
        }
      }
    });
  }
});
