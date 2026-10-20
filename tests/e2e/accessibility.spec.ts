import axe from "axe-core";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signUpAndReachDashboard } from "./helpers";

const baseline = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "audit-exceptions.json"), "utf8"),
).accessibilityBaseline;
const publicRoutes = ["/", "/explore", "/login"];
const authenticatedRoutes = [
  "/dashboard",
  "/dashboard/projects",
  "/clips",
  "/wallet",
  "/earnings",
  "/settings",
];

async function auditPage(page: Page, route: string) {
  await page.goto(route, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const axeInstance = (window as Window & { axe: typeof axe }).axe;
    const result = await axeInstance.run(document);
    return result.violations.map(({ id, impact, description }) => ({ id, impact, description }));
  });

  const blocking = violations.filter(
    ({ impact }) => impact === "critical" || impact === "serious",
  );
  const informational = violations.filter(
    ({ impact }) => impact === "moderate" || impact === "minor",
  );
  const known = new Set(
    (baseline.violations as { route: string; id: string }[])
      .filter((violation) => violation.route === route)
      .map((violation) => violation.id),
  );

  for (const violation of informational) {
    console.warn(
      `[a11y:${route}] ${violation.impact} ${violation.id}${known.has(violation.id) ? " (baseline)" : " (new)"}: ${violation.description}`,
    );
  }
  for (const resolved of known) {
    if (!violations.some((violation) => violation.id === resolved)) {
      console.info(`[a11y:${route}] baseline violation resolved: ${resolved}`);
    }
  }
  expect(blocking, `Critical/serious axe violations on ${route}`).toEqual([]);
}

test("full-page axe audits for public and authenticated routes", async ({ page }) => {
  test.setTimeout(300_000);
  await page.route("**/api/clips?**", (route) =>
    route.fulfill({ json: { data: { clips: [], total: 0 } } }),
  );

  for (const route of publicRoutes) await auditPage(page, route);
  await signUpAndReachDashboard(page, "a11y-audit");
  for (const route of authenticatedRoutes) await auditPage(page, route);
});
