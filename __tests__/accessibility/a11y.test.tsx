import React from "react";
import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "@jest/globals";

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
});
