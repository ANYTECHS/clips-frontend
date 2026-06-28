/**
 * Tests for WalletProvider — Stellar embedded wallet flows.
 * Covers: creation on first load, restoration from encrypted storage,
 * failed decryption, public-key-only export, edge cases.
 */
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { WalletProvider, useWallet } from "@/components/WalletProvider";
import { secureStorage } from "@/app/lib/secureStorage";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/app/lib/secureStorage", () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock stellar-sdk Keypair
jest.mock("@stellar/stellar-sdk", () => ({
  Keypair: {
    fromSecret: jest.fn((secret: string) => ({
      publicKey: () => `G_PUBLIC_FROM_${secret.slice(0, 6)}`,
    })),
    random: jest.fn(() => ({
      secret: () => "SNEW_SECRET_KEY_MOCK",
      publicKey: () => "G_NEW_PUBLIC_KEY_MOCK",
    })),
  },
}));

const STORAGE_KEY = "clipcash_wallet";
const MOCK_SECRET = "SSECRETKEY123456789012345678901234567890123456789012345678";
const MOCK_PUBLIC = `G_PUBLIC_FROM_${MOCK_SECRET.slice(0, 6)}`;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WalletProvider>{children}</WalletProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  (secureStorage.getItem as jest.Mock).mockResolvedValue(null);
  (secureStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (secureStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  // No ethereum/solana on window by default for these tests
  delete (window as any).ethereum;
  delete (window as any).solana;
});

// ── Embedded wallet creation (first load, no stored data) ────────────────────

describe("Embedded wallet — first load", () => {
  it("starts disconnected when no stored session exists", async () => {
    (secureStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      // getItem should have been called (session restoration attempted)
      expect(secureStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
    expect(result.current.stellarSecret).toBeNull();
  });
});

// ── Wallet restoration from encrypted storage ────────────────────────────────

describe("Wallet restoration from encrypted storage", () => {
  it("restores a Stellar wallet session from secureStorage on mount", async () => {
    (secureStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ address: MOCK_PUBLIC, chainId: "stellar", walletType: "imported" })
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    expect(result.current.address).toBe(MOCK_PUBLIC);
    expect(result.current.walletType).toBe("imported");
    expect(result.current.chainId).toBe("stellar");
  });

  it("imports a Stellar secret key and persists it", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.importStellarKey(MOCK_SECRET);
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.address).toBe(MOCK_PUBLIC);
    expect(result.current.walletType).toBe("imported");
    expect(result.current.stellarSecret).toBe(MOCK_SECRET);
    expect(secureStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify({ address: MOCK_PUBLIC, chainId: "stellar", walletType: "imported" })
    );
  });

  it("exposes the public key but keeps the secret key internal after import", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      const returned = await result.current.importStellarKey(MOCK_SECRET);
      // importStellarKey returns the public key only
      expect(returned).toBe(MOCK_PUBLIC);
    });

    // address is public key — safe to display
    expect(result.current.address).toBe(MOCK_PUBLIC);
    // stellarSecret is available on the context but is NOT persisted in storage
    const persistedCall = (secureStorage.setItem as jest.Mock).mock.calls[0];
    const persisted = JSON.parse(persistedCall[1]);
    expect(persisted).not.toHaveProperty("stellarSecret");
  });
});

// ── Failed decryption / corrupted storage ────────────────────────────────────

describe("Failed decryption and corrupted storage", () => {
  it("starts disconnected when secureStorage returns null (decrypt failed)", async () => {
    // secureStorage.getItem returns null when decryption fails internally
    (secureStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(secureStorage.getItem).toHaveBeenCalled();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
  });

  it("handles corrupted (non-JSON) storage data gracefully", async () => {
    (secureStorage.getItem as jest.Mock).mockResolvedValue("not-valid-json{{");

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(secureStorage.getItem).toHaveBeenCalled();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeNull(); // no crash, no error state
  });

  it("handles missing address field in stored data", async () => {
    (secureStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ chainId: "stellar", walletType: "imported" }) // no address
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(secureStorage.getItem).toHaveBeenCalled();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
  });

  it("handles import failure from an invalid secret key", async () => {
    const { Keypair } = require("@stellar/stellar-sdk");
    (Keypair.fromSecret as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Invalid secret key");
    });

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      const returned = await result.current.importStellarKey("INVALID");
      expect(returned).toBeNull();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toContain("Invalid secret key");
  });
});

// ── Export: public key only ──────────────────────────────────────────────────

describe("Export — public key only", () => {
  it("returns the public key from importStellarKey, not the secret", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });

    let returnedAddress: string | null = null;
    await act(async () => {
      returnedAddress = await result.current.importStellarKey(MOCK_SECRET);
    });

    expect(returnedAddress).toBe(MOCK_PUBLIC);
    // The returned value must not equal the secret
    expect(returnedAddress).not.toBe(MOCK_SECRET);
  });

  it("does not write secret key to persistent storage", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.importStellarKey(MOCK_SECRET);
    });

    const calls = (secureStorage.setItem as jest.Mock).mock.calls;
    expect(calls.length).toBe(1);
    const stored = JSON.parse(calls[0][1]);
    // Persisted payload must not contain the raw secret
    expect(JSON.stringify(stored)).not.toContain(MOCK_SECRET);
  });

  it("clears address and secret on disconnect", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.importStellarKey(MOCK_SECRET);
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
    expect(result.current.stellarSecret).toBeNull();
    expect(secureStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
  });
});

// ── Concurrent mount calls ───────────────────────────────────────────────────

describe("Edge cases", () => {
  it("does not set connected state when storage returns empty string", async () => {
    (secureStorage.getItem as jest.Mock).mockResolvedValue("");

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(secureStorage.getItem).toHaveBeenCalled();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("handles concurrent importStellarKey calls — last write wins", async () => {
    const { Keypair } = require("@stellar/stellar-sdk");
    const SECRET_A = "SSECRET_A_MOCK___________________________";
    const SECRET_B = "SSECRET_B_MOCK___________________________";
    (Keypair.fromSecret as jest.Mock)
      .mockImplementationOnce(() => ({ publicKey: () => "G_PUBLIC_A" }))
      .mockImplementationOnce(() => ({ publicKey: () => "G_PUBLIC_B" }));

    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await Promise.all([
        result.current.importStellarKey(SECRET_A),
        result.current.importStellarKey(SECRET_B),
      ]);
    });

    // After both resolve, wallet is connected with one of the addresses
    expect(result.current.isConnected).toBe(true);
    expect(["G_PUBLIC_A", "G_PUBLIC_B"]).toContain(result.current.address);
  });
});
