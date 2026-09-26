import React from "react";
import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "@jest/globals";
import { ThemeProvider, useTheme } from "@/components/theme-provider";

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
  it("has no automatically detectable accessibility violations", async () => {
    const { container } = render(<AccessibleExample />);
    const results = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });

    expect(results.violations).toHaveLength(0);
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

      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: true },
        },
      });

      expect(results.violations).toHaveLength(0);
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

      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: true },
        },
      });

      expect(results.violations).toHaveLength(0);
    });
  });
});
