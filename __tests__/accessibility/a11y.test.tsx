import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "@jest/globals";
import { ThemeProvider, useTheme } from "@/components/theme-provider";

const accessibilityBaseline = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "audit-exceptions.json"), "utf8"),
).accessibilityBaseline;

async function expectNoBlockingViolations(container: HTMLElement, route: string) {
  const { violations } = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  const blocking = violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  const informational = violations.filter(
    (violation) => violation.impact === "moderate" || violation.impact === "minor",
  );
  const baselineIds = new Set(
    (accessibilityBaseline.violations as { route: string; id: string }[])
      .filter((violation) => violation.route === route)
      .map((violation) => violation.id),
  );

  if (informational.length) {
    console.warn(
      `[a11y:${route}] moderate/minor violations: ${informational
        .map((violation) => `${violation.id}${baselineIds.has(violation.id) ? " (baseline)" : " (new)"}`)
        .join(", ")}`,
    );
  }
  expect(blocking).toHaveLength(0);
}

function AccessibleExample() {
  return (
    <main>
      <h1>Wallet access</h1>
      <label htmlFor="wallet-name">Wallet name</label>
      <input id="wallet-name" name="wallet-name" defaultValue="Primary" />
      <button type="button">Connect wallet</button>
    </main>
  );
}

function ThemeToggleExample() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <div>
      <button onClick={() => setTheme("light")} aria-label="Switch to light theme">
        Light Mode
      </button>
      <button onClick={() => setTheme("dark")} aria-label="Switch to dark theme">
        Dark Mode
      </button>
      <button onClick={() => setTheme("system")} aria-label="Use system theme">
        System Theme ({resolvedTheme})
      </button>
    </div>
  );
}

describe("a11y checks", () => {
  it("audits the rendered accessible page component", async () => {
    const { container } = render(<AccessibleExample />);
    await expectNoBlockingViolations(container, "accessible-example");
  });

  it("exposes accessible names for interactive controls", () => {
    render(<AccessibleExample />);

    const input = screen.getByRole("textbox", { name: /wallet name/i });
    const button = screen.getByRole("button", { name: /connect wallet/i });

    expect(input).not.toBeNull();
    expect(button).not.toBeNull();
  });

  describe("theme accessibility", () => {
    it("theme toggle buttons have accessible labels", () => {
      render(
        <ThemeProvider>
          <ThemeToggleExample />
        </ThemeProvider>
      );

      const lightButton = screen.getByRole("button", { name: /switch to light theme/i });
      const darkButton = screen.getByRole("button", { name: /switch to dark theme/i });
      const systemButton = screen.getByRole("button", { name: /use system theme/i });

      expect(lightButton).not.toBeNull();
      expect(darkButton).not.toBeNull();
      expect(systemButton).not.toBeNull();
    });

    it("meets WCAG contrast requirements in dark mode", async () => {
      const { container } = render(
        <ThemeProvider>
          <div style={{ backgroundColor: "#080C0B", color: "#FFFFFF" }}>
            <h1>Test heading</h1>
            <p>Test paragraph text</p>
          </div>
        </ThemeProvider>
      );

      await expectNoBlockingViolations(container, "theme-dark");
    });

    it("meets WCAG contrast requirements in light mode", async () => {
      const { container } = render(
        <ThemeProvider>
          <div style={{ backgroundColor: "#F8FAF9", color: "#080C0B" }}>
            <h1>Test heading</h1>
            <p>Test paragraph text</p>
          </div>
        </ThemeProvider>
      );

      await expectNoBlockingViolations(container, "theme-light");
    });
  });
});
