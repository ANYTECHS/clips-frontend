/**
 * Tests for multiWalletStorage.ts — Issue #436
 *
 * Covers:
 * - addWallet: first wallet, subsequent wallets, primary/active flags
 * - removeWallet: removes correctly, re-assigns active/primary on removal
 * - setActiveWallet (switch primary): deactivates previous, activates new
 * - getAll / getWalletData: list wallets, active/primary resolution
 * - migrateFromSingleWallet: migration path from single-wallet storage
 * - Error paths: storage unavailable, storage full, wallet not found
 * - Concurrent add/remove consistency
 *
 * localStorage is mocked via jest.spyOn so no real storage is touched.
 */

import {
  MultiWalletStorage,
  MultiWalletStorageError,
  MultiWalletRecord,
  WalletProviderType,
} from "@/app/lib/multiWalletStorage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_A = "user_alice";
const USER_B = "user_bob";
const PREFIX = "clipcash_multi_wallets_";

function walletKey(userId: string) {
  return `${PREFIX}${userId}`;
}

function makeWalletInput(
  overrides: Partial<Omit<MultiWalletRecord, "id" | "userId" | "createdAt" | "lastUsedAt">> = {}
): Omit<MultiWalletRecord, "id" | "userId" | "createdAt" | "lastUsedAt"> {
  return {
    publicKey: "GABCDE1234567890",
    walletType: "embedded" as WalletProviderType,
    isPrimary: false,
    isActive: false,
    label: "Test Wallet",
    ...overrides,
  };
}

// In-memory localStorage stand-in
function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    store,
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    reset() { store = {}; this.getItem.mockClear(); this.setItem.mockClear(); this.removeItem.mockClear(); },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let lsMock: ReturnType<typeof makeLocalStorageMock>;

beforeEach(() => {
  lsMock = makeLocalStorageMock();
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(lsMock.getItem);
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(lsMock.setItem);
  jest.spyOn(Storage.prototype, "removeItem").mockImplementation(lsMock.removeItem);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── getAll ───────────────────────────────────────────────────────────────────

describe("MultiWalletStorage.getAll", () => {
  it("returns empty array when no wallets are stored", () => {
    expect(MultiWalletStorage.getAll(USER_A)).toEqual([]);
  });

  it("returns wallets for the correct user only", () => {
    const w = MultiWalletStorage.addWallet(USER_A, makeWalletInput());
    expect(MultiWalletStorage.getAll(USER_A)).toHaveLength(1);
    expect(MultiWalletStorage.getAll(USER_B)).toHaveLength(0);
  });

  it("returns all wallets in insertion order", () => {
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_1" }));
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_2" }));
    const all = MultiWalletStorage.getAll(USER_A);
    expect(all.map((w) => w.publicKey)).toEqual(["KEY_1", "KEY_2"]);
  });

  it("returns empty array when stored JSON is malformed", () => {
    lsMock.store[walletKey(USER_A)] = "{{not json}}";
    expect(MultiWalletStorage.getAll(USER_A)).toEqual([]);
  });
});

// ─── addWallet ────────────────────────────────────────────────────────────────

describe("MultiWalletStorage.addWallet", () => {
  it("first wallet is automatically primary and active", () => {
    const w = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ isPrimary: false, isActive: false }));
    expect(w.isPrimary).toBe(true);
    expect(w.isActive).toBe(true);
  });

  it("returns wallet with generated id, userId, createdAt, lastUsedAt", () => {
    const w = MultiWalletStorage.addWallet(USER_A, makeWalletInput());
    expect(w.id).toMatch(/^wallet_/);
    expect(w.userId).toBe(USER_A);
    expect(w.createdAt).toBeTruthy();
    expect(w.lastUsedAt).toBeTruthy();
  });

  it("persists wallet to localStorage under correct key", () => {
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "G_TEST" }));
    expect(lsMock.setItem).toHaveBeenCalledWith(
      walletKey(USER_A),
      expect.stringContaining("G_TEST")
    );
  });

  it("adding a second wallet deactivates the first when isActive=true", () => {
    const first = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_1" }));
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_2", isActive: true }));
    const all = MultiWalletStorage.getAll(USER_A);
    const firstStored = all.find((w) => w.id === first.id)!;
    const second = all.find((w) => w.publicKey === "KEY_2")!;
    expect(firstStored.isActive).toBe(false);
    expect(second.isActive).toBe(true);
  });

  it("adding a wallet with isPrimary=true unmarks previous primary", () => {
    const first = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_1" }));
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_2", isPrimary: true, isActive: false }));
    const all = MultiWalletStorage.getAll(USER_A);
    expect(all.find((w) => w.id === first.id)!.isPrimary).toBe(false);
    expect(all.find((w) => w.publicKey === "KEY_2")!.isPrimary).toBe(true);
  });

  it("throws STORAGE_UNAVAILABLE when localStorage is not accessible", () => {
    jest.restoreAllMocks();
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("SecurityError"); });
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("SecurityError"); });
    expect(() => MultiWalletStorage.addWallet(USER_A, makeWalletInput())).toThrow(MultiWalletStorageError);
  });

  it("throws STORAGE_FULL when quota is exceeded on setItem", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    MultiWalletStorage.addWallet(USER_A, makeWalletInput()); // first call seeds getAll via getItem mock
    expect(() =>
      MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_2" }))
    ).toThrow(MultiWalletStorageError);
  });
});

// ─── removeWallet ─────────────────────────────────────────────────────────────

describe("MultiWalletStorage.removeWallet", () => {
  it("removes the specified wallet", () => {
    const w = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_1" }));
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_2" }));
    MultiWalletStorage.removeWallet(USER_A, w.id);
    const all = MultiWalletStorage.getAll(USER_A);
    expect(all.find((x) => x.id === w.id)).toBeUndefined();
    expect(all).toHaveLength(1);
  });

  it("re-assigns isActive to another wallet when active wallet is removed", () => {
    const first = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_1" }));
    // first is active by default (it's the first wallet)
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_2", isActive: false }));
    MultiWalletStorage.removeWallet(USER_A, first.id);
    const remaining = MultiWalletStorage.getAll(USER_A);
    expect(remaining[0].isActive).toBe(true);
  });

  it("re-assigns isPrimary to another wallet when primary wallet is removed", () => {
    const first = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_1" }));
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_2", isPrimary: false }));
    MultiWalletStorage.removeWallet(USER_A, first.id);
    const remaining = MultiWalletStorage.getAll(USER_A);
    expect(remaining[0].isPrimary).toBe(true);
  });

  it("removing the only wallet results in an empty list", () => {
    const w = MultiWalletStorage.addWallet(USER_A, makeWalletInput());
    MultiWalletStorage.removeWallet(USER_A, w.id);
    expect(MultiWalletStorage.getAll(USER_A)).toHaveLength(0);
  });

  it("removing a non-existent wallet id is a no-op", () => {
    MultiWalletStorage.addWallet(USER_A, makeWalletInput());
    expect(() => MultiWalletStorage.removeWallet(USER_A, "does_not_exist")).not.toThrow();
    expect(MultiWalletStorage.getAll(USER_A)).toHaveLength(1);
  });
});

// ─── setActiveWallet (switch primary wallet) ──────────────────────────────────

describe("MultiWalletStorage.setActiveWallet", () => {
  it("sets the target wallet as active and deactivates all others", () => {
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_1" }));
    const second = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_2", isActive: false }));
    MultiWalletStorage.setActiveWallet(USER_A, second.id);
    const all = MultiWalletStorage.getAll(USER_A);
    expect(all.find((w) => w.id === second.id)!.isActive).toBe(true);
    expect(all.filter((w) => w.isActive)).toHaveLength(1);
  });

  it("updates lastUsedAt on the activated wallet", () => {
    const before = new Date(Date.now() - 5000).toISOString();
    const first = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_1" }));
    // Manually set an old lastUsedAt
    const stored = MultiWalletStorage.getAll(USER_A);
    stored[0].lastUsedAt = before;
    lsMock.store[walletKey(USER_A)] = JSON.stringify(stored);

    MultiWalletStorage.setActiveWallet(USER_A, first.id);
    const updated = MultiWalletStorage.getAll(USER_A)[0];
    expect(updated.lastUsedAt > before).toBe(true);
  });

  it("throws WALLET_NOT_FOUND for unknown walletId", () => {
    MultiWalletStorage.addWallet(USER_A, makeWalletInput());
    expect(() => MultiWalletStorage.setActiveWallet(USER_A, "ghost_id")).toThrow(MultiWalletStorageError);
  });
});

// ─── getWalletData ────────────────────────────────────────────────────────────

describe("MultiWalletStorage.getWalletData", () => {
  it("returns activeWallet and primaryWallet correctly", () => {
    const first = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_1" }));
    const second = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "KEY_2", isActive: true }));
    const data = MultiWalletStorage.getWalletData(USER_A);
    expect(data.activeWallet?.id).toBe(second.id);
    expect(data.primaryWallet?.id).toBe(first.id);
  });

  it("returns null activeWallet and primaryWallet for empty store", () => {
    const data = MultiWalletStorage.getWalletData(USER_A);
    expect(data.activeWallet).toBeNull();
    expect(data.primaryWallet).toBeNull();
    expect(data.wallets).toHaveLength(0);
  });
});

// ─── migrateFromSingleWallet ──────────────────────────────────────────────────

describe("MultiWalletStorage.migrateFromSingleWallet", () => {
  it("creates an embedded primary wallet from single-wallet data", () => {
    const result = MultiWalletStorage.migrateFromSingleWallet(USER_A, {
      publicKey: "STELLAR_KEY",
      walletType: "embedded",
      network: "testnet",
    });
    expect(result).not.toBeNull();
    expect(result!.publicKey).toBe("STELLAR_KEY");
    expect(result!.isPrimary).toBe(true);
    expect(result!.isActive).toBe(true);
  });

  it("returns null when wallets already exist (already migrated)", () => {
    MultiWalletStorage.addWallet(USER_A, makeWalletInput());
    const result = MultiWalletStorage.migrateFromSingleWallet(USER_A, {
      publicKey: "ANOTHER_KEY",
      walletType: "metamask",
    });
    expect(result).toBeNull();
  });

  it("stores the secret key encoded when provided", () => {
    const secret = "STEST_SECRET_KEY";
    MultiWalletStorage.migrateFromSingleWallet(USER_A, {
      publicKey: "G_KEY",
      secretKey: secret,
      walletType: "imported",
    });
    // getSecretKey should decode it back
    const wallets = MultiWalletStorage.getAll(USER_A);
    const retrieved = MultiWalletStorage.getSecretKey(USER_A, wallets[0].id);
    expect(retrieved).toBe(secret);
  });

  it("does not store _encodedSecret when no secretKey is provided", () => {
    MultiWalletStorage.migrateFromSingleWallet(USER_A, {
      publicKey: "G_KEY",
      walletType: "freighter",
    });
    const wallets = MultiWalletStorage.getAll(USER_A);
    expect(wallets[0]._encodedSecret).toBeUndefined();
  });
});

// ─── clearAll ─────────────────────────────────────────────────────────────────

describe("MultiWalletStorage.clearAll", () => {
  it("removes all wallets for a user", () => {
    MultiWalletStorage.addWallet(USER_A, makeWalletInput());
    MultiWalletStorage.clearAll(USER_A);
    expect(MultiWalletStorage.getAll(USER_A)).toHaveLength(0);
  });

  it("does not affect wallets for other users", () => {
    MultiWalletStorage.addWallet(USER_A, makeWalletInput());
    MultiWalletStorage.addWallet(USER_B, makeWalletInput({ publicKey: "B_KEY" }));
    MultiWalletStorage.clearAll(USER_A);
    expect(MultiWalletStorage.getAll(USER_B)).toHaveLength(1);
  });
});

// ─── Concurrent add/remove consistency ───────────────────────────────────────

describe("Concurrent add/remove consistency", () => {
  it("multiple sequential addWallet calls result in correct count", () => {
    for (let i = 0; i < 10; i++) {
      MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: `KEY_${i}` }));
    }
    expect(MultiWalletStorage.getAll(USER_A)).toHaveLength(10);
  });

  it("interleaved add and remove keeps the store consistent", () => {
    const w1 = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "K1" }));
    const w2 = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "K2" }));
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "K3" }));
    MultiWalletStorage.removeWallet(USER_A, w1.id);
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "K4" }));
    MultiWalletStorage.removeWallet(USER_A, w2.id);
    const all = MultiWalletStorage.getAll(USER_A);
    expect(all).toHaveLength(2);
    expect(all.map((w) => w.publicKey)).toEqual(expect.arrayContaining(["K3", "K4"]));
  });

  it("exactly one wallet is active after a series of addWallet calls", () => {
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "K1" }));
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "K2", isActive: true }));
    MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "K3", isActive: true }));
    const all = MultiWalletStorage.getAll(USER_A);
    expect(all.filter((w) => w.isActive)).toHaveLength(1);
  });

  it("exactly one wallet is primary after multiple setPrimary calls", () => {
    const w1 = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "K1" }));
    const w2 = MultiWalletStorage.addWallet(USER_A, makeWalletInput({ publicKey: "K2" }));
    MultiWalletStorage.updateWallet(USER_A, w2.id, { isPrimary: true });
    MultiWalletStorage.updateWallet(USER_A, w1.id, { isPrimary: true });
    const all = MultiWalletStorage.getAll(USER_A);
    expect(all.filter((w) => w.isPrimary)).toHaveLength(1);
    expect(all.find((w) => w.isPrimary)!.id).toBe(w1.id);
  });
});
