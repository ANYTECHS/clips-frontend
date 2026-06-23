/**
 * multiWalletStorage.ts
 *
 * Extended storage layer for managing multiple wallets per user.
 *
 * This extends the single-wallet storage to support:
 * - Primary embedded wallet (auto-created on signup)
 * - Multiple external wallets (MetaMask, Phantom, Freighter, etc.)
 * - Wallet switching and selection
 * - Wallet metadata (label, last used, etc.)
 *
 * Storage structure:
 * - Key: `clipcash_multi_wallets_{userId}`
 * - Value: JSON array of wallet records
 */

const MULTI_WALLET_STORE_PREFIX = "clipcash_multi_wallets_";

export type WalletProviderType = "embedded" | "metamask" | "phantom" | "freighter" | "stellar" | "imported";

export interface MultiWalletRecord {
  /** Unique identifier for this wallet record */
  id: string;
  /** User ID who owns this wallet */
  userId: string;
  /** Public key/address of the wallet */
  publicKey: string;
  /** Type of wallet provider */
  walletType: WalletProviderType;
  /** Network (for Stellar wallets) */
  network?: "testnet" | "mainnet";
  /** Whether this is the primary embedded wallet */
  isPrimary: boolean;
  /** Whether this wallet is currently active/selected */
  isActive: boolean;
  /** User-defined label for the wallet */
  label?: string;
  /** Chain ID (for EVM wallets) */
  chainId?: string;
  /** Obfuscated secret key (only for embedded/imported wallets) */
  _encodedSecret?: string;
  /** When this wallet was added */
  createdAt: string;
  /** When this wallet was last used */
  lastUsedAt: string;
}

export interface MultiWalletStorageResult {
  wallets: MultiWalletRecord[];
  activeWallet: MultiWalletRecord | null;
  primaryWallet: MultiWalletRecord | null;
}

export type StorageErrorCode =
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_FULL"
  | "SERIALIZATION_ERROR"
  | "DECODE_ERROR"
  | "WALLET_NOT_FOUND";

export class MultiWalletStorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "MultiWalletStorageError";
  }
}

function isStorageAvailable(): boolean {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return false;
  }
  try {
    const probe = "__clipcash_multi_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function encodeKey(raw: string): string {
  return btoa(raw);
}

function decodeKey(encoded: string): string {
  return atob(encoded);
}

function generateWalletId(): string {
  return `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const MultiWalletStorage = {
  /**
   * Get all wallets for a user
   */
  getAll(userId: string): MultiWalletRecord[] {
    if (!isStorageAvailable()) return [];
    try {
      const raw = localStorage.getItem(`${MULTI_WALLET_STORE_PREFIX}${userId}`);
      if (!raw) return [];
      return JSON.parse(raw) as MultiWalletRecord[];
    } catch {
      return [];
    }
  },

  /**
   * Get complete wallet data including active and primary wallets
   */
  getWalletData(userId: string): MultiWalletStorageResult {
    const wallets = this.getAll(userId);
    const activeWallet = wallets.find((w) => w.isActive) || null;
    const primaryWallet = wallets.find((w) => w.isPrimary) || null;
    return { wallets, activeWallet, primaryWallet };
  },

  /**
   * Add a new wallet for a user
   */
  addWallet(
    userId: string,
    walletData: Omit<MultiWalletRecord, "id" | "userId" | "createdAt" | "lastUsedAt">
  ): MultiWalletRecord {
    if (!isStorageAvailable()) {
      throw new MultiWalletStorageError(
        "STORAGE_UNAVAILABLE",
        "localStorage is not available. Wallet cannot be persisted."
      );
    }

    const wallets = this.getAll(userId);
    const newWallet: MultiWalletRecord = {
      ...walletData,
      id: generateWalletId(),
      userId,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };

    // If this is the first wallet, make it both primary and active
    if (wallets.length === 0) {
      newWallet.isPrimary = true;
      newWallet.isActive = true;
    }

    // If setting as active, deactivate all other wallets
    if (newWallet.isActive) {
      wallets.forEach((w) => (w.isActive = false));
    }

    // If setting as primary, unmark all other wallets as primary
    if (newWallet.isPrimary) {
      wallets.forEach((w) => (w.isPrimary = false));
    }

    wallets.push(newWallet);

    try {
      localStorage.setItem(
        `${MULTI_WALLET_STORE_PREFIX}${userId}`,
        JSON.stringify(wallets)
      );
    } catch (err) {
      throw new MultiWalletStorageError(
        "STORAGE_FULL",
        "Storage quota exceeded. Please clear some browser data and try again.",
        err
      );
    }

    return newWallet;
  },

  /**
   * Update an existing wallet
   */
  updateWallet(userId: string, walletId: string, updates: Partial<MultiWalletRecord>): MultiWalletRecord | null {
    const wallets = this.getAll(userId);
    const walletIndex = wallets.findIndex((w) => w.id === walletId);

    if (walletIndex === -1) {
      throw new MultiWalletStorageError(
        "WALLET_NOT_FOUND",
        `Wallet with ID ${walletId} not found`
      );
    }

    const updatedWallet = { ...wallets[walletIndex], ...updates };

    // Handle active wallet switching
    if (updates.isActive && !wallets[walletIndex].isActive) {
      wallets.forEach((w) => (w.isActive = false));
    }

    // Handle primary wallet switching
    if (updates.isPrimary && !wallets[walletIndex].isPrimary) {
      wallets.forEach((w) => (w.isPrimary = false));
    }

    wallets[walletIndex] = updatedWallet;

    try {
      localStorage.setItem(
        `${MULTI_WALLET_STORE_PREFIX}${userId}`,
        JSON.stringify(wallets)
      );
    } catch (err) {
      throw new MultiWalletStorageError(
        "STORAGE_FULL",
        "Storage quota exceeded. Please clear some browser data and try again.",
        err
      );
    }

    return updatedWallet;
  },

  /**
   * Set a wallet as active
   */
  setActiveWallet(userId: string, walletId: string): MultiWalletRecord | null {
    return this.updateWallet(userId, walletId, { 
      isActive: true, 
      lastUsedAt: new Date().toISOString() 
    });
  },

  /**
   * Remove a wallet
   */
  removeWallet(userId: string, walletId: string): void {
    const wallets = this.getAll(userId);
    const filtered = wallets.filter((w) => w.id !== walletId);

    // If removing the active wallet, activate another one
    const wasActive = wallets.find((w) => w.id === walletId)?.isActive;
    if (wasActive && filtered.length > 0) {
      filtered[0].isActive = true;
    }

    // If removing the primary wallet, make another one primary
    const wasPrimary = wallets.find((w) => w.id === walletId)?.isPrimary;
    if (wasPrimary && filtered.length > 0) {
      filtered[0].isPrimary = true;
    }

    try {
      localStorage.setItem(
        `${MULTI_WALLET_STORE_PREFIX}${userId}`,
        JSON.stringify(filtered)
      );
    } catch {
      // Silently ignore
    }
  },

  /**
   * Get the secret key for a wallet (only for embedded/imported wallets)
   */
  getSecretKey(userId: string, walletId: string): string | null {
    const wallets = this.getAll(userId);
    const wallet = wallets.find((w) => w.id === walletId);
    if (!wallet || !wallet._encodedSecret) return null;
    try {
      return decodeKey(wallet._encodedSecret);
    } catch {
      return null;
    }
  },

  /**
   * Clear all wallets for a user
   */
  clearAll(userId: string): void {
    if (!isStorageAvailable()) return;
    try {
      localStorage.removeItem(`${MULTI_WALLET_STORE_PREFIX}${userId}`);
    } catch {
      // Silently ignore
    }
  },

  /**
   * Migrate from single-wallet storage to multi-wallet storage
   */
  migrateFromSingleWallet(userId: string, singleWalletData: {
    publicKey: string;
    secretKey?: string;
    walletType: WalletProviderType;
    network?: "testnet" | "mainnet";
    chainId?: string;
  }): MultiWalletRecord | null {
    const existing = this.getAll(userId);
    if (existing.length > 0) {
      // Already migrated or has wallets
      return null;
    }

    return this.addWallet(userId, {
      publicKey: singleWalletData.publicKey,
      walletType: singleWalletData.walletType,
      network: singleWalletData.network,
      chainId: singleWalletData.chainId,
      isPrimary: true,
      isActive: true,
      label: getDefaultWalletLabel(singleWalletData.walletType),
      _encodedSecret: singleWalletData.secretKey ? encodeKey(singleWalletData.secretKey) : undefined,
    });
  },
};

function getDefaultWalletLabel(walletType: WalletProviderType): string {
  switch (walletType) {
    case "embedded":
      return "Primary Wallet";
    case "metamask":
      return "MetaMask";
    case "phantom":
      return "Phantom";
    case "freighter":
      return "Freighter";
    case "stellar":
      return "Stellar Wallet";
    case "imported":
      return "Imported Wallet";
    default:
      return "Wallet";
  }
}
