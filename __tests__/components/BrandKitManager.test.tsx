import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BrandKitManager from "@/components/brand/BrandKitManager";
import { I18nProvider } from "@/app/lib/i18n/I18nProvider";
import { INITIAL_BRAND_KITS } from "@/app/lib/brandKit";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("BrandKitManager Component", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes("/api/brand-kits")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: INITIAL_BRAND_KITS,
              activeKit: INITIAL_BRAND_KITS[0],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });
  });

  it("loads and displays the brand kit manager with active kit", async () => {
    renderWithI18n(<BrandKitManager />);

    await waitFor(() => {
      expect(screen.getByText("Brand Kit Integration")).toBeInTheDocument();
    });

    expect(screen.getByText("Clips Neon (Primary) (Active)")).toBeInTheDocument();
    expect(screen.getByText("Auto-apply branding to clips")).toBeInTheDocument();
  });

  it("navigates across tabs (logos, typography, guidelines, preview)", async () => {
    renderWithI18n(<BrandKitManager />);

    await waitFor(() => {
      expect(screen.getByText("Brand Kit Integration")).toBeInTheDocument();
    });

    // Click Logos tab
    const logosTab = screen.getByText("Logos & Watermarks");
    fireEvent.click(logosTab);
    expect(screen.getByText("Upload Logo")).toBeInTheDocument();

    // Click Typography tab
    const typoTab = screen.getByText("Typography");
    fireEvent.click(typoTab);
    expect(screen.getByText("Primary Font")).toBeInTheDocument();

    // Click Guidelines tab
    const guidelinesTab = screen.getByText("Brand Guidelines & Rules");
    fireEvent.click(guidelinesTab);
    expect(
      screen.getByText("Enforce strict palette (disallow non-brand colors)")
    ).toBeInTheDocument();
  });

  it("displays WCAG contrast compliance status", async () => {
    renderWithI18n(<BrandKitManager />);

    await waitFor(() => {
      expect(screen.getByText("Brand Kit Integration")).toBeInTheDocument();
    });

    expect(screen.getByText(/WCAG AA Pass/i)).toBeInTheDocument();
  });
});
