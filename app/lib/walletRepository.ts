/**
 * walletRepository.ts
 *
 * Unified facade for wallet storage operations.
 * Delegates to walletStorage.ts (embedded) and multiWalletStorage.ts (external).
 *
 * LocalStorage Namespace:
 * - Embedded Wallet: clipcash_ew_{userId}
 * - Multi Wallet: clipcash_multi_wallets_{userId}
 */

import { WalletStorage, StoredWalletRecord } from "./walletStorage";
import { MultiWalletStorage, MultiWalletRecord, WalletProviderType, MultiWalletStorageResult } from "./multiWalletStorage";

export type { StoredWalletRecord } from "./walletStorage";
export type { MultiWalletRecord, WalletProviderType, MultiWalletStorageResult } from "./multiWalletStorage";

export const LOCAL_STORAGE_KEYS = {
  embedded: "clipcash_ew_",
  multi: "clipcash_multi_wallets_"
};

export const WalletRepository = {
  // Embedded wallet operations
  saveEmbeddedWallet(userId: string, record: Omit<StoredWalletRecord, "_encodedSecret"> & { secretKey: string }): void {
    WalletStorage.save(userId, record);
  },
  
  getEmbeddedWallet(userId: string): StoredWalletRecord | null {
    return WalletStorage.get(userId);
  },
  
  getEmbeddedSecretKey(userId: string): string | null {
    return WalletStorage.getSecretKey(userId);
  },
  
  removeEmbeddedWallet(userId: string): void {
    WalletStorage.remove(userId);
  },
  
  embeddedExists(userId: string): boolean {
    return WalletStorage.exists(userId);
  },

  // Multi wallet operations
  getAllMultiWallets(userId: string): MultiWalletRecord[] {
    return MultiWalletStorage.getAll(userId);
  },

  getMultiWalletData(userId: string): MultiWalletStorageResult {
    return MultiWalletStorage.getWalletData(userId);
  },

  addMultiWallet(userId: string, walletData: Omit<MultiWalletRecord, "id" | "userId" | "createdAt" | "lastUsedAt">): MultiWalletRecord {
    return MultiWalletStorage.addWallet(userId, walletData);
  },

  updateMultiWallet(userId: string, walletId: string, updates: Partial<MultiWalletRecord>): MultiWalletRecord | null {
    return MultiWalletStorage.updateWallet(userId, walletId, updates);
  },

  setActiveMultiWallet(userId: string, walletId: string): MultiWalletRecord | null {
    return MultiWalletStorage.setActiveWallet(userId, walletId);
  },

  removeMultiWallet(userId: string, walletId: string): void {
    MultiWalletStorage.removeWallet(userId, walletId);
  },

  getMultiWalletSecretKey(userId: string, walletId: string): string | null {
    return MultiWalletStorage.getSecretKey(userId, walletId);
  },

  clearAllMultiWallets(userId: string): void {
    MultiWalletStorage.clearAll(userId);
  },

  migrateToMultiWallet(userId: string, singleWalletData: {
    publicKey: string;
    secretKey?: string;
    walletType: WalletProviderType;
    network?: "testnet" | "mainnet";
    chainId?: string;
  }): MultiWalletRecord | null {
    return MultiWalletStorage.migrateFromSingleWallet(userId, singleWalletData);
  }
};

export { WalletStorage, WalletStorageError } from './walletStorage';
export { MultiWalletStorage, MultiWalletStorageError } from './multiWalletStorage';
