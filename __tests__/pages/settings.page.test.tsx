import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsPage from "@/app/(dashboard)/settings/page";

const mockSetUser = jest.fn();
const mockImportStellarKey = jest.fn().mockResolvedValue(undefined);
const mockShowToast = jest.fn();

jest.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u1", walletNetwork: "testnet" },
    setUser: mockSetUser,
    isLoading: false,
  }),
}));

jest.mock("@/components/WalletProvider", () => ({
  useWallet: () => ({
    isConnected: true,
    walletType: "stellar",
    address: "GTEST",
    stellarSecret: "S".repeat(56),
    stellarMnemonic: "word ".repeat(12),
    importStellarKey: mockImportStellarKey,
    isRestoringSession: false,
  }),
}));

jest.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
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

describe("SettingsPage", () => {
  beforeEach(() => {
    mockSetUser.mockClear();
    mockShowToast.mockClear();
  });

  it("toggles wallet network between testnet and mainnet", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Mainnet" }));

    expect(mockSetUser).toHaveBeenCalledWith(
      expect.objectContaining({ walletNetwork: "mainnet" })
    );
  });

  it("reveals and hides the stellar secret key", async () => {
    render(<SettingsPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Toggle Advanced Wallet Mode" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    expect(screen.getByText("S".repeat(56))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByText("S".repeat(56))).not.toBeInTheDocument();
  });
});
