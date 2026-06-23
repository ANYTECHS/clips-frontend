/**
 * Tests for useMultiWalletConnection — Issue #514
 *
 * Verifies the race-condition fix:
 *   - connectMetaMask / connectPhantom use the address returned by the
 *     connect promise rather than stale context state.
 *   - When the connect method returns null (simulated old/broken provider),
 *     the hook falls back to polling wallet.address from context.
 *   - The address is captured correctly without requiring a second render cycle.
 */

import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useMultiWalletConnection } from "@/app/hooks/useMultiWalletConnection";

// ─── Mock providers ───────────────────────────────────────────────────────────

const MOCK_USER = { id: "user_123", email: "test@example.com" };

// Track calls to addWallet
const mockAddWallet = jest.fn();
const mockMultiWallet = {
  wallets: [],
  activeWallet: null,
  primaryWallet: null,
  isOperating: false,
  error: null,
  addWallet: mockAddWallet,
  removeWallet: jest.fn(),
  switchWallet: jest.fn(),
  setPrimaryWallet: jest.fn(),
  updateWallet: jest.fn(),
  refreshWallets: jest.fn(),
  clearError: jest.fn(),
};

jest.mock("@/components/AuthProvider", () => ({
  useAuth: jest.fn(() => ({ user: MOCK_USER })),
}));

jest.mock("@/components/MultiWalletProvider", () => ({
  useMultiWallet: jest.fn(() => mockMultiWallet),
  migrateToMultiWallet: jest.fn(),
}));

// WalletProvider mock — configurable per test
const mockWalletState: {
  address: string | null;
  chainId: string | null;
  walletType: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  stellarSecret: string | null;
  connectMetaMask: jest.Mock;
  connectPhantom: jest.Mock;
  connectStellar: jest.Mock;
  importStellarKey: jest.Mock;
  disconnect: jest.Mock;
  clearError: jest.Mock;
} = {
  address: null,
  chainId: null,
  walletType: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  stellarSecret: null,
  connectMetaMask: jest.fn(),
  connectPhantom: jest.fn(),
  connectStellar: jest.fn(),
  importStellarKey: jest.fn(),
  disconnect: jest.fn(),
  clearError: jest.fn(),
};

jest.mock("@/components/WalletProvider", () => ({
  useWallet: jest.fn(() => mockWalletState),
}));

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockWalletState.address = null;
  mockWalletState.chainId = null;
  mockWalletState.walletType = null;
  mockWalletState.isConnected = false;
  mockAddWallet.mockResolvedValue({ id: "wallet_1", publicKey: "0xABC" });
});

// ─── Race condition fix: address from returned promise ───────────────────────

describe("connectMetaMask — uses returned address (issue #514)", () => {
  it("passes the address returned by the connect promise to addWallet", async () => {
    const EXPECTED_ADDRESS = "0x1234567890abcdef";

    // Connect promise returns the address — context is NOT yet updated
    mockWalletState.connectMetaMask.mockResolvedValue(EXPECTED_ADDRESS);
    // wallet.address in context remains null (the race condition scenario)
    mockWalletState.address = null;

    const { result } = renderHook(() => useMultiWalletConnection());

    await act(async () => {
      await result.current.connectMetaMask();
    });

    expect(mockAddWallet).toHaveBeenCalledWith(
      expect.objectContaining({ publicKey: EXPECTED_ADDRESS, walletType: "metamask" })
    );
  });

  it("captures the address without a second render cycle", async () => {
    const EXPECTED_ADDRESS = "0xdeadbeef";
    mockWalletState.connectMetaMask.mockResolvedValue(EXPECTED_ADDRESS);
    // Never update wallet.address — simulates context not having re-rendered
    mockWalletState.address = null;

    const { result } = renderHook(() => useMultiWalletConnection());
    let addWalletCalledAt: number | null = null;

    mockAddWallet.mockImplementation(async (data: { publicKey: string }) => {
      addWalletCalledAt = Date.now();
      return { id: "w1", publicKey: data.publicKey };
    });

    await act(async () => {
      await result.current.connectMetaMask();
    });

    // addWallet must have been called with the correct address
    expect(mockAddWallet).toHaveBeenCalledWith(
      expect.objectContaining({ publicKey: EXPECTED_ADDRESS })
    );
    expect(addWalletCalledAt).not.toBeNull();
  });

  it("does NOT call addWallet when connect returns null and context never updates", async () => {
    // Simulate a broken provider that returns null and never updates context
    mockWalletState.connectMetaMask.mockResolvedValue(null);
    mockWalletState.address = null; // context also null

    const { result } = renderHook(() => useMultiWalletConnection());

    await act(async () => {
      await result.current.connectMetaMask();
    });

    expect(mockAddWallet).not.toHaveBeenCalled();
  });
});

// ─── Fallback poll ────────────────────────────────────────────────────────────

describe("connectMetaMask — polling fallback when connect returns null", () => {
  it("uses context address when connect returns null but context updates async", async () => {
    const POLLED_ADDRESS = "0xpolled_address";
    const { useWallet } = require("@/components/WalletProvider");

    // Phase 1: connect returns null; wallet.address is null
    mockWalletState.connectMetaMask.mockResolvedValue(null);
    mockWalletState.address = null;

    // Simulate a re-render that updates wallet.address ~60ms after connect
    // by swapping the useWallet return value and triggering a re-render.
    let triggerAddressUpdate: (() => void) | null = null;
    const connectPromise = new Promise<void>((resolve) => {
      triggerAddressUpdate = resolve;
    });

    // Override connectMetaMask to: return null, then schedule the address update
    mockWalletState.connectMetaMask.mockImplementation(async () => {
      setTimeout(() => {
        mockWalletState.address = POLLED_ADDRESS;
        triggerAddressUpdate?.();
      }, 60);
      return null;
    });

    useWallet.mockImplementation(() => ({ ...mockWalletState }));

    const { result, rerender } = renderHook(() => useMultiWalletConnection());

    // Start the connect (don't await yet — let the timeout fire while polling)
    let connectDone = false;
    act(() => {
      result.current.connectMetaMask().then(() => { connectDone = true; });
    });

    // Wait for the timeout to fire and update the address
    await connectPromise;

    // Re-render so the hook's useEffect picks up the new wallet.address
    rerender();

    // Now wait for connect to finish (it polls 50ms × 20)
    await waitFor(() => expect(connectDone).toBe(true), { timeout: 2000 });

    expect(mockAddWallet).toHaveBeenCalledWith(
      expect.objectContaining({ publicKey: POLLED_ADDRESS })
    );
  });
});

// ─── connectPhantom ───────────────────────────────────────────────────────────

describe("connectPhantom — uses returned address", () => {
  it("passes the address returned by the connect promise to addWallet", async () => {
    const PHANTOM_ADDRESS = "SolanaPublicKeyBase58XYZ";
    mockWalletState.connectPhantom.mockResolvedValue(PHANTOM_ADDRESS);
    mockWalletState.address = null; // context not yet updated

    const { result } = renderHook(() => useMultiWalletConnection());

    await act(async () => {
      await result.current.connectPhantom();
    });

    expect(mockAddWallet).toHaveBeenCalledWith(
      expect.objectContaining({ publicKey: PHANTOM_ADDRESS, walletType: "phantom" })
    );
  });
});

// ─── importStellarKey ─────────────────────────────────────────────────────────

describe("importStellarKey — uses returned address", () => {
  it("passes the address returned by the import to addWallet", async () => {
    const STELLAR_ADDRESS = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBFCNKUYZAKK3PJQHFXCX";
    mockWalletState.importStellarKey.mockResolvedValue(STELLAR_ADDRESS);
    mockWalletState.address = null;

    const { result } = renderHook(() => useMultiWalletConnection());

    await act(async () => {
      await result.current.importStellarKey("SECRET_KEY");
    });

    expect(mockAddWallet).toHaveBeenCalledWith(
      expect.objectContaining({ publicKey: STELLAR_ADDRESS, walletType: "imported" })
    );
  });
});
