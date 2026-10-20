import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsPage from "@/app/(dashboard)/settings/page";

const mockImportStellarKey = jest.fn().mockResolvedValue(undefined);

jest.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u1", walletNetwork: "testnet" },
    setUser: jest.fn(),
    isLoading: false,
  }),
}));

jest.mock("@/components/WalletProvider", () => ({
  useWallet: () => ({
    isConnected: false,
    walletType: null,
    address: null,
    stellarSecret: null,
    stellarMnemonic: null,
    importStellarKey: mockImportStellarKey,
    isRestoringSession: false,
  }),
}));

jest.mock("@/app/hooks/usePasskeyWallet", () => ({
  usePasskeyWallet: () => ({
    credentialId: null,
    publicKey: null,
    isSupported: false,
    isRegistering: false,
    error: null,
    compatibility: null,
    register: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock("@/components/SocialRecoveryConfig", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/app/lib/notifications", () => ({
  getStoredPermission: () => "default",
  requestNotificationPermission: jest.fn(),
  storePermission: jest.fn(),
}));

describe("SettingsPage import key form", () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)
    );
  });

  it("imports a stellar secret key from the advanced wallet form", async () => {
    render(<SettingsPage initialTab="wallet" />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Toggle Advanced Wallet Mode" })
    );

    fireEvent.change(
      await screen.findByPlaceholderText(/Starts with 'S'/i),
      { target: { value: "S".repeat(56) } }
    );

    fireEvent.click(screen.getByRole("button", { name: /Import Secret Key/i }));

    await waitFor(() => {
      expect(mockImportStellarKey).toHaveBeenCalledWith("S".repeat(56));
    });
  });
});
