/**
 * Tests for MultiWalletProvider — Issue #436
 *
 * Covers:
 * - Initial state: empty wallets for unauthenticated user
 * - addWallet: wallet appears in context, analytics fired
 * - removeWallet: blocked for primary, allowed for secondary
 * - switchWallet: context reflects new active wallet
 * - setPrimaryWallet: new primary reflected in context
 * - refreshWallets: re-reads storage and updates state
 * - migrateToMultiWallet helper: runs migration once
 * - Error state: set and cleared correctly
 *
 * localStorage is mocked via jest.spyOn(Storage.prototype, ...).
 * AuthProvider is mocked to control the authenticated user.
 * analytics and walletErrorTracking are mocked to avoid side-effects.
 */

import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  MultiWalletProvider,
  useMultiWallet,
  migrateToMultiWallet,
} from "@/components/MultiWalletProvider";
import { MultiWalletStorage } from "@/app/lib/multiWalletStorage";

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockUser = { id: "user_test_123", email: "test@clips.app" };

jest.mock("@/components/AuthProvider", () => ({
  useAuth: jest.fn(() => ({ user: mockUser })),
}));

jest.mock("@/lib/analytics", () => ({
  __esModule: true,
  default: { trackEvent: jest.fn() },
}));

jest.mock("@/app/lib/walletErrorTracking", () => ({
  captureWalletError: jest.fn(),
  logWalletOperation: jest.fn(),
  addWalletBreadcrumb: jest.fn(),
  setWalletUserContext: jest.fn(),
}));

// ─── localStorage mock ────────────────────────────────────────────────────────

let lsStore: Record<string, string> = {};

beforeEach(() => {
  lsStore = {};
  jest.spyOn(Storage.prototype, "getItem").mockImplementation((key) => lsStore[key] ?? null);
  jest.spyOn(Storage.prototype, "setItem").mockImplementation((key, val) => { lsStore[key] = val; });
  jest.spyOn(Storage.prototype, "removeItem").mockImplementation((key) => { delete lsStore[key]; });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

// ─── Wrapper ──────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MultiWalletProvider>{children}</MultiWalletProvider>
);

function baseWallet(overrides = {}) {
  return {
    publicKey: "GABCDEFGHIJKLMNOP",
    walletType: "embedded" as const,
    isPrimary: false,
    isActive: false,
    label: "Test Wallet",
    ...overrides,
  };
}

// ─── Initial state ────────────────────────────────────────────────────────────

describe("MultiWalletProvider — initial state", () => {
  it("starts with empty wallets and null activeWallet", async () => {
    const { result } = renderHook(() => useMultiWallet(), { wrapper });
    await waitFor(() => {
      expect(result.current.wallets).toHaveLength(0);
      expect(result.current.activeWallet).toBeNull();
      expect(result.current.primaryWallet).toBeNull();
    });
  });

  it("starts with isOperating=false and error=null", () => {
    const { result } = renderHook(() => useMultiWallet(), { wrapper });
    expect(result.current.isOperating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("clears state when user is null", async () => {
    const { useAuth } = require("@/components/AuthProvider");
    useAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useMultiWallet(), { wrapper });
    await waitFor(() => {
      expect(result.current.wallets).toHaveLength(0);
    });

    useAuth.mockReturnValue({ user: mockUser });
  });
});

// ─── addWallet ────────────────────────────────────────────────────────────────

describe("MultiWalletProvider — addWallet", () => {
  it("adds a wallet and updates wallets state", async () => {
    const { result } = renderHook(() => useMultiWallet(), { wrapper });

    let added: any;
    await act(async () => {
      added = await result.current.addWallet(baseWallet({ publicKey: "G_NEW_KEY" }));
    });

    expect(result.current.wallets).toHaveLength(1);
    expect(result.current.wallets[0].publicKey).toBe("G_NEW_KEY");
  });

  it("first added wallet becomes active and primary", async () => {
    const { result } = renderHook(() => useMultiWallet(), { wrapper });
    await act(async () => {
      await result.current.addWallet(baseWallet({ publicKey: "G_FIRST" }));
    });
    expect(result.current.activeWallet?.publicKey).toBe("G_FIRST");
    expect(result.current.primaryWallet?.publicKey).toBe("G_FIRST");
  });

  it("fires analytics.trackEvent('wallet_added') on success", async () => {
    const analytics = require("@/lib/analytics").default;
    const { result } = renderHook(() => useMultiWallet(), { wrapper });
    await act(async () => {
      await result.current.addWallet(baseWallet());
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith(
      "wallet_added",
      expect.objectContaining({ wallet_type: "embedded" })
    );
  });

  it("sets error state when storage throws", async () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

    const { result } = renderHook(() => useMultiWallet(), { wrapper });
    await act(async () => {
      try {
        await result.current.addWallet(baseWallet());
      } catch {}
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
  });
});

// ─── removeWallet ─────────────────────────────────────────────────────────────

describe("MultiWalletProvider — removeWallet", () => {
  it("removes a non-primary wallet successfully", async () => {
    const { result } = renderHook(() => useMultiWallet(), { wrapper });

    let first: any, second: any;
    await act(async () => {
      first = await result.current.addWallet(baseWallet({ publicKey: "K1" }));
      second = await result.current.addWallet(baseWallet({ publicKey: "K2", isActive: true }));
    });

    act(() => {
      result.current.removeWallet(second.id);
    });

    await waitFor(() => {
      expect(result.current.wallets).toHaveLength(1);
      expect(result.current.wallets[0].publicKey).toBe("K1");
    });
  });

  it("sets error and does NOT remove the primary wallet", async () => {
    const { result } = renderHook(() => useMultiWallet(), { wrapper });

    let primary: any;
    await act(async () => {
      primary = await result.current.addWallet(baseWallet({ publicKey: "PRIMARY" }));
    });

    act(() => {
      result.current.removeWallet(primary.id);
    });

    await waitFor(() => {
      expect(result.current.error).toMatch(/Cannot remove primary wallet/i);
      expect(result.current.wallets).toHaveLength(1);
    });
  });
});

// ─── switchWallet ─────────────────────────────────────────────────────────────

describe("MultiWalletProvider — switchWallet", () => {
  it("makes the target wallet active", async () => {
    const { result } = renderHook(() => useMultiWallet(), { wrapper });

    let first: any, second: any;
    await act(async () => {
      first = await result.current.addWallet(baseWallet({ publicKey: "K1" }));
      second = await result.current.addWallet(baseWallet({ publicKey: "K2" }));
    });

    act(() => {
      result.current.switchWallet(second.id);
    });

    await waitFor(() => {
      expect(result.current.activeWallet?.publicKey).toBe("K2");
    });
  });

  it("fires analytics.trackEvent('wallet_switched') on success", async () => {
    const analytics = require("@/lib/analytics").default;
    const { result } = renderHook(() => useMultiWallet(), { wrapper });

    let first: any, second: any;
    await act(async () => {
      first = await result.current.addWallet(baseWallet({ publicKey: "K1" }));
      second = await result.current.addWallet(baseWallet({ publicKey: "K2" }));
    });

    analytics.trackEvent.mockClear();
    act(() => result.current.switchWallet(second.id));

    await waitFor(() => {
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        "wallet_switched",
        expect.any(Object)
      );
    });
  });
});

// ─── setPrimaryWallet ─────────────────────────────────────────────────────────

describe("MultiWalletProvider — setPrimaryWallet", () => {
  it("designates the target wallet as primary", async () => {
    const { result } = renderHook(() => useMultiWallet(), { wrapper });

    let first: any, second: any;
    await act(async () => {
      first = await result.current.addWallet(baseWallet({ publicKey: "K1" }));
      second = await result.current.addWallet(baseWallet({ publicKey: "K2" }));
    });

    act(() => {
      result.current.setPrimaryWallet(second.id);
    });

    await waitFor(() => {
      expect(result.current.primaryWallet?.publicKey).toBe("K2");
    });
  });

  it("only one wallet is primary after setPrimaryWallet", async () => {
    const { result } = renderHook(() => useMultiWallet(), { wrapper });

    let first: any, second: any;
    await act(async () => {
      first = await result.current.addWallet(baseWallet({ publicKey: "K1" }));
      second = await result.current.addWallet(baseWallet({ publicKey: "K2" }));
    });

    act(() => result.current.setPrimaryWallet(second.id));
    await waitFor(() => {
      expect(result.current.wallets.filter((w) => w.isPrimary)).toHaveLength(1);
    });
  });
});

// ─── clearError ───────────────────────────────────────────────────────────────

describe("MultiWalletProvider — clearError", () => {
  it("clears the error state", async () => {
    const { result } = renderHook(() => useMultiWallet(), { wrapper });

    let primary: any;
    await act(async () => {
      primary = await result.current.addWallet(baseWallet());
    });

    act(() => result.current.removeWallet(primary.id)); // sets error
    await waitFor(() => expect(result.current.error).not.toBeNull());

    act(() => result.current.clearError());
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});

// ─── refreshWallets ───────────────────────────────────────────────────────────

describe("MultiWalletProvider — refreshWallets", () => {
  it("re-reads storage after an external modification", async () => {
    const { result } = renderHook(() => useMultiWallet(), { wrapper });

    // Add wallet directly via storage (simulating external write)
    MultiWalletStorage.addWallet(mockUser.id, baseWallet({ publicKey: "EXTERNAL" }));

    act(() => result.current.refreshWallets());

    await waitFor(() => {
      expect(result.current.wallets.some((w) => w.publicKey === "EXTERNAL")).toBe(true);
    });
  });
});

// ─── migrateToMultiWallet ─────────────────────────────────────────────────────

describe("migrateToMultiWallet helper", () => {
  it("creates a primary wallet from single-wallet data", () => {
    migrateToMultiWallet(mockUser.id, {
      publicKey: "G_MIGRATE",
      walletType: "embedded",
      network: "testnet",
    });
    const all = MultiWalletStorage.getAll(mockUser.id);
    expect(all).toHaveLength(1);
    expect(all[0].publicKey).toBe("G_MIGRATE");
    expect(all[0].isPrimary).toBe(true);
  });

  it("is idempotent — second call is a no-op", () => {
    migrateToMultiWallet(mockUser.id, { publicKey: "G_M1", walletType: "embedded" });
    migrateToMultiWallet(mockUser.id, { publicKey: "G_M2", walletType: "metamask" });
    expect(MultiWalletStorage.getAll(mockUser.id)).toHaveLength(1);
    expect(MultiWalletStorage.getAll(mockUser.id)[0].publicKey).toBe("G_M1");
  });
});
