import { expect, test } from "@playwright/test";

import { signUpAndReachDashboard } from "./helpers";

const NETWORK_OVERRIDE_KEY = "clipcash_network_override";
const PREFERENCES_KEY = "clipcash_user_preferences";

test.describe("Network switcher (E2E)", () => {
  test.beforeEach(async ({ page }) => {
    // Start every run on testnet regardless of env defaults.
    await page.addInitScript((key) => {
      if (!sessionStorage.getItem("__network_e2e_init")) {
        localStorage.setItem(key, "testnet");
        sessionStorage.setItem("__network_e2e_init", "1");
      }
    }, NETWORK_OVERRIDE_KEY);
    await signUpAndReachDashboard(page, "network-switcher");
  });

  test("shows the active network badge in the dashboard header", async ({ page }) => {
    const badge = page.getByTestId("network-badge");
    await expect(badge).toHaveText(/testnet/i);
    await expect(badge).toHaveAttribute("data-network", "testnet");
    await expect(page.getByTestId("mainnet-banner")).toHaveCount(0);
  });

  test("requires typing MAINNET before switching, then updates the network context", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Switch to Mainnet" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      "You are switching to Mainnet. Transactions will use real XLM. This cannot be undone."
    );

    const confirm = dialog.getByRole("button", { name: "Switch to Mainnet" });
    const input = dialog.getByLabel("Type MAINNET to confirm");

    // Wrong text keeps the confirm button disabled.
    await expect(confirm).toBeDisabled();
    await input.fill("mainnet");
    await expect(confirm).toBeDisabled();

    await input.fill("MAINNET");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("network-badge")).toHaveAttribute("data-network", "mainnet");
    await expect(page.getByTestId("mainnet-banner")).toHaveText(
      "You are on Mainnet — real funds in use"
    );

    // Preference persisted in userPreferences and the override key.
    const stored = await page.evaluate(
      ([overrideKey, prefsKey]) => ({
        override: localStorage.getItem(overrideKey),
        prefs: JSON.parse(localStorage.getItem(prefsKey) ?? "{}"),
      }),
      [NETWORK_OVERRIDE_KEY, PREFERENCES_KEY]
    );
    expect(stored.override).toBe("mainnet");
    expect(stored.prefs.wallet.defaultNetwork).toBe("mainnet");

    // Banner persists across pages.
    await page.goto("/wallet");
    await expect(page.getByTestId("mainnet-banner")).toBeVisible();
  });

  test("cancelling the dialog keeps the current network", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to Mainnet" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(page.getByTestId("network-badge")).toHaveAttribute("data-network", "testnet");
    await expect(page.getByTestId("mainnet-banner")).toHaveCount(0);
  });

  test("switching back to testnet needs no confirmation", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to Mainnet" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByLabel("Type MAINNET to confirm").fill("MAINNET");
    await dialog.getByRole("button", { name: "Switch to Mainnet" }).click();

    await page.getByRole("button", { name: "Switch to Testnet" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByTestId("network-badge")).toHaveAttribute("data-network", "testnet");
    await expect(page.getByTestId("mainnet-banner")).toHaveCount(0);
  });
});
