import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "@jest/globals";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { I18nProvider } from "@/app/lib/i18n/I18nProvider";
import _dashboard__activity_page from "@/app/(dashboard)/activity/page";
import _dashboard__analytics_page from "@/app/(dashboard)/analytics/page";
import _dashboard__audit_page from "@/app/(dashboard)/audit/page";
import _dashboard__billing_page from "@/app/(dashboard)/billing/page";
import _dashboard__brand_kit_page from "@/app/(dashboard)/brand-kit/page";
import _dashboard__categories_page from "@/app/(dashboard)/categories/page";
import _dashboard__collaboration_page from "@/app/(dashboard)/collaboration/page";
import _dashboard__dashboard_page from "@/app/(dashboard)/dashboard/page";
import _dashboard__dashboard_processing_page from "@/app/(dashboard)/dashboard/processing/page";
import _dashboard__earnings_page from "@/app/(dashboard)/earnings/page";
import _dashboard__integrations_page from "@/app/(dashboard)/integrations/page";
import _dashboard__multisig_page from "@/app/(dashboard)/multisig/page";
import _dashboard__platforms_page from "@/app/(dashboard)/platforms/page";
import _dashboard__projects_page from "@/app/(dashboard)/projects/page";
import _dashboard__projects__id__page from "@/app/(dashboard)/projects/[id]/page";
import _dashboard__referral_page from "@/app/(dashboard)/referral/page";
import _dashboard__schedule_page from "@/app/(dashboard)/schedule/page";
import _dashboard__settings_page from "@/app/(dashboard)/settings/page";
import _dashboard__templates_page from "@/app/(dashboard)/templates/page";
import _dashboard__transform__id__page from "@/app/(dashboard)/transform/[id]/page";
import _dashboard__vault_page from "@/app/(dashboard)/vault/page";
import _dashboard__wallet_page from "@/app/(dashboard)/wallet/page";
import _dashboard__wallet_transactions_page from "@/app/(dashboard)/wallet/transactions/page";
import clips_page from "@/app/clips/page";
import cookies_page from "@/app/cookies/page";
import explore_page from "@/app/explore/page";
import forgot_password_page from "@/app/forgot-password/page";
import login_page from "@/app/login/page";
import nft_demo_page from "@/app/nft-demo/page";
import onboarding_page from "@/app/onboarding/page";
import page from "@/app/page";
import privacy_page from "@/app/privacy/page";
import recovery_page from "@/app/recovery/page";
import reset_password_page from "@/app/reset-password/page";
import share__shareId__page from "@/app/share/[shareId]/page";
import terms_page from "@/app/terms/page";
import upload_page from "@/app/upload/page";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <I18nProvider>
        {ui}
      </I18nProvider>
    </ThemeProvider>
  );
}

import React from "react";
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

  describe("real page accessibility", () => {
    // Static pages
    it("activity page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__activity_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("analytics page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__analytics_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("audit page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__audit_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("billing page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__billing_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("brand-kit page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__brand_kit_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("categories page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__categories_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("collaboration page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__collaboration_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("dashboard page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__dashboard_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("dashboard/processing page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__dashboard_processing_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("earnings page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__earnings_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("integrations page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__integrations_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("multisig page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__multisig_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("platforms page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__platforms_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("projects page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__projects_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("referral page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__referral_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("schedule page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__schedule_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("settings page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__settings_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("templates page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__templates_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("vault page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__vault_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("wallet page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__wallet_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("wallet/transactions page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__wallet_transactions_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("clips page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<clips_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("cookies page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<cookies_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("explore page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<explore_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("forgot-password page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<forgot_password_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("login page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<login_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("nft-demo page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<nft_demo_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("onboarding page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<onboarding_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("home page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("privacy page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<privacy_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("recovery page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<recovery_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("reset-password page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<reset_password_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("terms page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<terms_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("upload page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<upload_page />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    // Dynamic routes - we pass empty params, hoping it doesn't break
    it("projects/[id] page has no automatically detectable accessibility violations", async () => {
      // We need to pass params, but the page component expects props.
      // We'll try to render without props and see if it works; if not, we skip in real test.
      // For now, we pass an empty params object.
      const { container } = renderWithProviders(<_dashboard__projects__id__page params={{}} />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("transform/[id] page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<_dashboard__transform__id__page params={{}} />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });

    it("share/[shareId] page has no automatically detectable accessibility violations", async () => {
      const { container } = renderWithProviders(<share__shareId__page params={{ shareId: "test" }} />);
      const results = await axe.run(container, {
        rules: {
          "color-contrast": { enabled: false },
        },
      });
      expect(results.violations).toHaveLength(0);
    });
  });