/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { StellarWalletProvider } from "@/components/StellarWalletProvider";
import { EmbeddedWalletProvider, useEmbeddedWallet } from "@/components/EmbeddedWalletProvider";
import * as embeddedWalletModule from "@/app/lib/embeddedWallet";
import { useSession } from "next-auth/react";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

jest.mock("@/app/lib/embeddedWallet", () => {
  const original = jest.requireActual("@/app/lib/embeddedWallet");
  return {
    ...original,
    getEmbeddedWallet: jest.fn(),
    createEmbeddedWallet: jest.fn(),
  };
});

jest.mock("@/app/lib/secureStorage", () => ({
  migrateCryptoSalt: jest.fn(),
}));

const mockUseSession = useSession as jest.Mock;
const mockGetEmbeddedWallet = embeddedWalletModule.getEmbeddedWallet as jest.Mock;
const mockCreateEmbeddedWallet = embeddedWalletModule.createEmbeddedWallet as jest.Mock;

function TestConsumer() {
  const { wallet, isLoading, error } = useEmbeddedWallet();
  if (isLoading) return <div data-testid="loading">Loading...</div>;
  if (error) return <div data-testid="error">{error}</div>;
  if (!wallet) return <div data-testid="no-wallet">No Wallet</div>;
  return <div data-testid="wallet-public-key">{wallet.publicKey}</div>;
}

describe("StellarWalletProvider & EmbeddedWalletProvider (#810)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads existing wallet when found for authenticated user", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      status: "authenticated",
    });

    const mockWallet = {
      publicKey: "GABCD1234567890WXYZ",
      network: "testnet",
      walletType: "embedded",
      isActivated: true,
      createdAt: new Date().toISOString(),
    };

    mockGetEmbeddedWallet.mockResolvedValue(mockWallet);

    render(
      <StellarWalletProvider>
        <TestConsumer />
      </StellarWalletProvider>
    );

    expect(screen.getByTestId("loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("wallet-public-key")).toHaveTextContent("GABCD1234567890WXYZ");
    });

    expect(mockGetEmbeddedWallet).toHaveBeenCalledWith("user-123");
    expect(mockCreateEmbeddedWallet).not.toHaveBeenCalled();
  });

  it("triggers wallet creation when wallet is not found on first login", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-456", email: "newuser@example.com" } },
      status: "authenticated",
    });

    mockGetEmbeddedWallet.mockResolvedValue(null);

    const newCreatedWallet = {
      wallet: {
        publicKey: "GNEWWALLET987654321",
        network: "testnet",
        walletType: "embedded",
        isActivated: true,
        createdAt: new Date().toISOString(),
      },
      alreadyExisted: false,
    };

    mockCreateEmbeddedWallet.mockResolvedValue(newCreatedWallet);

    render(
      <StellarWalletProvider>
        <TestConsumer />
      </StellarWalletProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("wallet-public-key")).toHaveTextContent("GNEWWALLET987654321");
    });

    expect(mockGetEmbeddedWallet).toHaveBeenCalledWith("user-456");
    expect(mockCreateEmbeddedWallet).toHaveBeenCalledWith("user-456");
  });

  it("renders children without throwing when user is unauthenticated", async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    render(
      <StellarWalletProvider>
        <TestConsumer />
      </StellarWalletProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("no-wallet")).toBeInTheDocument();
    });
  });

  it("handles SSR safely without window access errors", () => {
    const originalWindow = global.window;
    // Simulate server side environment where window is undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).window;

    expect(() => {
      render(
        <EmbeddedWalletProvider>
          <div>SSR Test</div>
        </EmbeddedWalletProvider>
      );
    }).not.toThrow();

    global.window = originalWindow;
  });
});
