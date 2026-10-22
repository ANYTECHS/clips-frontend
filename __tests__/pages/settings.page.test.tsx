import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsPage } from "@/app/(dashboard)/settings/page";
import { analytics } from "@/app/lib/analytics";

const mockSetUser = jest.fn();
const mockImportStellarKey = jest.fn().mockResolvedValue(undefined);
const mockShowToast = jest.fn();

jest.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Alice", email: "alice@example.com", walletNetwork: "testnet" },
    setUser: mockSetUser,
    isLoading: false,
  }),
}));

jest.mock("@/components/WalletProvider", () => ({
  useWallet: () => ({
    isConnected: true,
    walletType: "stellar",
    address: "GTESTADDRESS12345",
    stellarSecret: "S".repeat(56),
    stellarMnemonic: "word ".repeat(12).trim(),
    importStellarKey: mockImportStellarKey,
    isRestoringSession: false,
  }),
}));

jest.mock("@/app/hooks/usePasskeyWallet", () => ({
  usePasskeyWallet: () => ({
    credentialId: "cred_test_123",
    publicKey: "GTESTADDRESS12345",
    isSupported: true,
    isRegistering: false,
    error: null,
    compatibility: { isSafari: false },
    register: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock("@/app/lib/analytics", () => ({
  analytics: {
    setOptOut: jest.fn(),
    trackEvent: jest.fn(),
  },
}));

jest.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("@/components/SocialRecoveryConfig", () => ({
  __esModule: true,
  default: () => <div data-testid="social-recovery-mock">Social Recovery Mock</div>,
}));

jest.mock("@/components/wallet/TrustlineManager", () => ({
  __esModule: true,
  TrustlineManager: () => <div data-testid="trustline-manager-mock">Trustline Manager Mock</div>,
}));

jest.mock("@/components/settings/MonthlyReportSetting", () => ({
  __esModule: true,
  default: () => <div data-testid="monthly-report-mock">Monthly Report Setting</div>,
}));

jest.mock("@/components/settings/PrivacySettings", () => ({
  __esModule: true,
  default: () => <div data-testid="privacy-settings-mock">Explore Privacy Settings</div>,
}));

jest.mock("@/components/LocaleSwitcher", () => ({
  __esModule: true,
  default: () => <div data-testid="locale-switcher-mock">Locale Switcher</div>,
}));

jest.mock("@/app/lib/browserNotifications", () => ({
  getStoredPermission: () => "default",
  getNotificationSettingsInstructions: () => "Open browser settings.",
  getNotificationSettingsUrl: () => null,
  requestNotificationPermission: jest.fn().mockResolvedValue("granted"),
  syncNotificationPermission: () => "default",
  storePermission: jest.fn(),
  watchNotificationPermission: () => jest.fn(),
}));

jest.mock("@/components/settings/NotificationChannelSettings", () => ({
  NotificationChannelSettings: () => null,
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/user/preferences")) {
        if (init?.method === "PATCH") {
          const body = JSON.parse((init.body as string) || "{}");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              notifications: { email: {}, push: {}, inApp: {}, ...body.notifications },
              display: { theme: "dark", language: "en", timezone: "UTC", ...body.display },
              wallet: { defaultNetwork: "testnet", gasPreference: "medium", autoConnect: false, ...body.wallet },
              privacy: { analyticsOptOut: false, dataExportStatus: "idle", dataExportRequestedAt: null, ...body.privacy },
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            notifications: {
              email: { job_complete: true, transform_complete: true, mint_success: true, earnings_received: true },
              push: { job_complete: true, transform_complete: true, mint_success: true, earnings_received: true },
              inApp: { job_complete: true, transform_complete: true, mint_success: true, earnings_received: true },
            },
            display: { theme: "dark", language: "en", timezone: "UTC" },
            wallet: { defaultNetwork: "testnet", gasPreference: "medium", autoConnect: false },
            privacy: { analyticsOptOut: false, dataExportStatus: "idle", dataExportRequestedAt: null },
          }),
        } as Response);
      }
      if (urlStr.includes("/api/user/export-data")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ profile: { id: "u1" }, preferences: {} }),
        } as Response);
      }
      if (urlStr.includes("/api/user/delete-account")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    });
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = jest.fn(() => "mock-blob-url");
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = jest.fn();
    }
  });

  it("renders all five tab buttons in navigation", async () => {
    render(<SettingsPage />);

    expect(screen.getByRole("tab", { name: /Profile/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Notifications/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Display/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Wallet/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Privacy/i })).toBeInTheDocument();
  });

  describe("Profile Tab", () => {
    it("renders profile details and verified email badge", async () => {
      render(<SettingsPage initialTab="profile" />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
        expect(screen.getByDisplayValue("alice@example.com")).toBeInTheDocument();
        expect(screen.getByLabelText("Email verified")).toBeInTheDocument();
      });
    });

    it("rejects avatar files exceeding 1 MB limit", async () => {
      render(<SettingsPage initialTab="profile" />);

      const fileInput = (await screen.findByLabelText("Upload avatar image")) as HTMLInputElement;
      const file = {
        name: "big.png",
        size: 1024 * 1024 + 500,
        type: "image/png",
      } as unknown as File;

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/exceeds maximum size limit of 1 MB/i)).toBeInTheDocument();
      });
    });

    it("rejects avatar files failing magic bytes inspection", async () => {
      render(<SettingsPage initialTab="profile" />);

      const fileInput = (await screen.findByLabelText("Upload avatar image")) as HTMLInputElement;
      const file = {
        name: "fake.png",
        size: 50,
        type: "image/png",
        arrayBuffer: () =>
          Promise.resolve(new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]).buffer),
      } as unknown as File;

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/Invalid image format/i)).toBeInTheDocument();
      });
    });
  });

  describe("Notifications Tab", () => {
    it("toggles event notifications across channels", async () => {
      render(<SettingsPage initialTab="notifications" />);

      await waitFor(() => {
        expect(screen.getByText("Job Complete")).toBeInTheDocument();
        expect(screen.getByText("Transform Complete")).toBeInTheDocument();
      });

      const emailToggle = screen.getByRole("switch", { name: /Toggle email for Job Complete/i });
      fireEvent.click(emailToggle);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/user/preferences",
          expect.objectContaining({
            method: "PATCH",
          })
        );
      });
    });
  });

  describe("Display Tab", () => {
    it("allows switching theme and selecting IANA timezone", async () => {
      render(<SettingsPage initialTab="display" />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Set theme to Light" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Set theme to Light" }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/user/preferences",
          expect.objectContaining({
            method: "PATCH",
            body: expect.stringContaining('"theme":"light"'),
          })
        );
      });

      const timezoneSelect = screen.getByLabelText("Select timezone");
      fireEvent.change(timezoneSelect, { target: { value: "America/New_York" } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/user/preferences",
          expect.objectContaining({
            method: "PATCH",
            body: expect.stringContaining('"timezone":"America/New_York"'),
          })
        );
      });
    });
  });

  describe("Wallet Tab", () => {
    it("toggles wallet network between testnet and mainnet", async () => {
      render(<SettingsPage initialTab="wallet" />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Mainnet" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Mainnet" }));

      expect(mockSetUser).toHaveBeenCalledWith(
        expect.objectContaining({ walletNetwork: "mainnet" })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/user/preferences",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"defaultNetwork":"mainnet"'),
        })
      );
    });

    it("reveals and hides the stellar secret key in advanced mode", async () => {
      render(<SettingsPage initialTab="wallet" />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Toggle Advanced Wallet Mode" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Toggle Advanced Wallet Mode" }));

      const revealBtn = await screen.findByRole("button", { name: "Reveal" });
      fireEvent.click(revealBtn);

      expect(screen.getByText("S".repeat(56))).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Hide" }));
      expect(screen.queryByText("S".repeat(56))).not.toBeInTheDocument();
    });

    it("toggles auto-connect and changes gas preference", async () => {
      render(<SettingsPage initialTab="wallet" />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Fast" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Fast" }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/user/preferences",
          expect.objectContaining({
            method: "PATCH",
            body: expect.stringContaining('"gasPreference":"fast"'),
          })
        );
      });

      const autoConnectSwitch = screen.getByRole("switch", { name: "Toggle auto-connect wallet" });
      fireEvent.click(autoConnectSwitch);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/user/preferences",
          expect.objectContaining({
            method: "PATCH",
            body: expect.stringContaining('"autoConnect":true'),
          })
        );
      });
    });
  });

  describe("Privacy Tab", () => {
    it("toggles analytics opt-out and calls analytics.setOptOut", async () => {
      render(<SettingsPage initialTab="privacy" />);

      await waitFor(() => {
        expect(screen.getByRole("switch", { name: "Opt out of analytics tracking" })).toBeInTheDocument();
      });

      const optOutSwitch = screen.getByRole("switch", { name: "Opt out of analytics tracking" });
      fireEvent.click(optOutSwitch);

      expect(analytics.setOptOut).toHaveBeenCalledWith(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/user/preferences",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"analyticsOptOut":true'),
        })
      );
    });

    it("requests data export archive", async () => {
      render(<SettingsPage initialTab="privacy" />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Download JSON Archive/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /Download JSON Archive/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/user/export-data");
      });
    });

    it("requires typing DELETE to confirm account deletion", async () => {
      render(<SettingsPage initialTab="privacy" />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Delete ClipCash Account/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /Delete ClipCash Account/i }));

      const confirmBtn = screen.getByRole("button", { name: "Permanently Delete Account" });
      expect(confirmBtn).toBeDisabled();

      const input = screen.getByPlaceholderText("DELETE");
      fireEvent.change(input, { target: { value: "DELETE" } });

      expect(confirmBtn).not.toBeDisabled();

      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/user/delete-account",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ confirmation: "DELETE" }),
          })
        );
      });
    });
  });
});
