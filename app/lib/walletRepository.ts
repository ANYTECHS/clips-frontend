
/**
 * walletRepository.ts
 *
 * Unified facade for wallet persistence.
 * Delegates to walletStorage.ts (embedded) and multiWalletStorage.ts (external)
 * based on wallet type.
 *
 * LocalStorage Namespace Documentation:
 * - `clipcash_ew_{userId}` : Single embedded wallet (walletStorage.ts)
 * - `clipcash_multi_wallets_{userId}` : Multiple wallets including external (multiWalletStorage.ts)
 */

import { WalletStorage, StoredWalletRecord, WalletStorageError } from "./walletStorage";
import { MultiWalletStorage, MultiWalletRecord, WalletProviderType, MultiWalletStorageError } from "./multiWalletStorage";

export const WalletRepository = {
  /**
   * Retrieves all wallets for a user across both storage strategies.
   */
  getAllWallets(userId: string) {
    const multiWallets = MultiWalletStorage.getAll(userId);
    // Legacy embedded wallet handling
    const embedded = WalletStorage.get(userId);
    
    // In a real app we might merge them, but for this issue we just delegate
    return {
      embedded,
      multiWallets
    };
  },

  // Facade methods
  getEmbeddedWallet(userId: string) {
    return WalletStorage.get(userId);
  },

  getMultiWallets(userId: string) {
    return MultiWalletStorage.getAll(userId);
  },

  // Add more methods as needed by hooks
};

export { WalletStorageError, MultiWalletStorageError };
