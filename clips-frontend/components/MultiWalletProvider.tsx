"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "./AuthProvider";
import { 
  MultiWalletStorage, 
  MultiWalletRecord, 
  WalletProviderType 
} from "@/app/lib/multiWalletStorage";
import analytics from "@/lib/analytics";
import { captureWalletError, logWalletOperation, addWalletBreadcrumb, setWalletUserContext } from "@/app/lib/walletErrorTracking";

/**
 * MultiWalletProvider - Manages multiple wallets per user
 * 
 * This provider extends the single-wallet model to support:
 * - Primary embedded wallet (auto-created on signup)
 * - Multiple external wallets (MetaMask, Phantom, Freighter, etc.)
 * - Wallet switching and selection
 * - Wallet metadata (label, last used, etc.)
 * 
 * Usage:
 * ```tsx
 * <MultiWalletProvider>
 *   <YourApp />
 * </MultiWalletProvider>
 * 
 * Then use the useMultiWallet hook:
 * ```tsx
 * const { wallets, activeWallet, addWallet, switchWallet } = useMultiWallet();
 * ```
 */

interface MultiWalletContextType {
  /** All wallets for the current user */
  wallets: MultiWalletRecord[];
  /** Currently active/selected wallet */
  activeWallet: MultiWalletRecord | null;
  /** Primary embedded wallet */
  primaryWallet: MultiWalletRecord | null;
  /** Whether a wallet operation is in progress */
  isOperating: boolean;
  /** Error message if an operation failed */
  error: string | null;
  /** Add a new wallet */
  addWallet: (
    walletData: Omit<MultiWalletRecord, "id" | "userId" | "createdAt" | "lastUsedAt">
  ) => Promise<MultiWalletRecord>;
  /** Remove a wallet */
  removeWallet: (walletId: string) => void;
  /** Switch to a different wallet */
  switchWallet: (walletId: string) => void;
  /** Set a wallet as primary */
  setPrimaryWallet: (walletId: string) => void;
  /** Update wallet metadata */
  updateWallet: (walletId: string, updates: Partial<MultiWalletRecord>) => void;
  /** Clear error */
  clearError: () => void;
  /** Refresh wallet list from storage */
  refreshWallets: () => void;
}

const MultiWalletContext = createContext<MultiWalletContextType>({
  wallets: [],
  activeWallet: null,
  primaryWallet: null,
  isOperating: false,
  error: null,
  addWallet: async () => {
    throw new Error("Not implemented");
  },
  removeWallet: () => {},
  switchWallet: () => {},
  setPrimaryWallet: () => {},
  updateWallet: () => {},
  clearError: () => {},
  refreshWallets: () => {},
});

export const useMultiWallet = () => useContext(MultiWalletContext);

interface MultiWalletProviderProps {
  children: React.ReactNode;
}

export function MultiWalletProvider({ children }: MultiWalletProviderProps) {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<MultiWalletRecord[]>([]);
  const [activeWallet, setActiveWallet] = useState<MultiWalletRecord | null>(null);
  const [primaryWalletState, setPrimaryWalletState] = useState<MultiWalletRecord | null>(null);
  const [isOperating, setIsOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id || null;

  // Load wallets when userId changes
  useEffect(() => {
    if (!userId) {
      setWallets([]);
      setActiveWallet(null);
      setPrimaryWalletState(null);
      setWalletUserContext(null);
      return;
    }

    setWalletUserContext(user);
    loadWallets();
  }, [userId]);

  const loadWallets = useCallback(() => {
    if (!userId) return;
    const data = MultiWalletStorage.getWalletData(userId);
    setWallets(data.wallets);
    setActiveWallet(data.activeWallet);
    setPrimaryWalletState(data.primaryWallet);
  }, [userId]);

  const addWallet = useCallback(
    async (
      walletData: Omit<MultiWalletRecord, "id" | "userId" | "createdAt" | "lastUsedAt">
    ): Promise<MultiWalletRecord> => {
      addWalletBreadcrumb("Adding wallet to multi-wallet list", "wallet");
      
      if (!userId) {
        const error = new Error("User not authenticated");
        captureWalletError(error, "add_wallet", { walletType: walletData.walletType });
        throw error;
      }

      setIsOperating(true);
      setError(null);

      try {
        const newWallet = MultiWalletStorage.addWallet(userId, walletData);
        loadWallets();
        
        // Track wallet addition
        analytics.trackEvent('wallet_added', {
          wallet_type: walletData.walletType,
          is_primary: walletData.isPrimary,
        });
        logWalletOperation("add_wallet", "success", { walletType: walletData.walletType, walletAddress: walletData.publicKey });

        return newWallet;
      } catch (err: any) {
        const message = err.message || "Failed to add wallet";
        captureWalletError(err, "add_wallet", { walletType: walletData.walletType, error: message });
        logWalletOperation("add_wallet", "error", { error: err, walletType: walletData.walletType });
        setError(message);
        throw err;
      } finally {
        setIsOperating(false);
      }
    },
    [userId, loadWallets]
  );

  const removeWallet = useCallback(
    (walletId: string) => {
      addWalletBreadcrumb("Removing wallet from multi-wallet list", "wallet");
      
      if (!userId) return;

      const wallet = wallets.find((w: MultiWalletRecord) => w.id === walletId);
      if (wallet?.isPrimary) {
        const error = "Cannot remove primary wallet";
        captureWalletError(new Error(error), "remove_wallet", { walletType: wallet?.walletType });
        setError(error);
        return;
      }

      try {
        MultiWalletStorage.removeWallet(userId, walletId);
        loadWallets();
        
        // Track wallet removal
        analytics.trackEvent('wallet_removed', {
          wallet_type: wallet?.walletType,
        });
        logWalletOperation("remove_wallet", "success", { walletType: wallet?.walletType, walletAddress: wallet?.publicKey });
      } catch (err: any) {
        captureWalletError(err, "remove_wallet", { walletType: wallet?.walletType, error: err.message });
        logWalletOperation("remove_wallet", "error", { error: err, walletType: wallet?.walletType });
        setError(err.message || "Failed to remove wallet");
      }
    },
    [userId, wallets, loadWallets]
  );

  const switchWallet = useCallback(
    (walletId: string) => {
      addWalletBreadcrumb("Switching active wallet", "wallet");
      
      if (!userId) return;

      try {
        const updated = MultiWalletStorage.setActiveWallet(userId, walletId);
        if (updated) {
          loadWallets();
          
          // Track wallet switch
          analytics.trackEvent('wallet_switched', {
            wallet_type: updated.walletType,
          });
          logWalletOperation("switch_wallet", "success", { walletType: updated.walletType, walletAddress: updated.publicKey });
        }
      } catch (err: any) {
        captureWalletError(err, "switch_wallet", { walletId, error: err.message });
        logWalletOperation("switch_wallet", "error", { error: err, walletId });
        setError(err.message || "Failed to switch wallet");
      }
    },
    [userId, loadWallets]
  );

  const setPrimaryWallet = useCallback(
    (walletId: string) => {
      addWalletBreadcrumb("Setting primary wallet", "wallet");
      
      if (!userId) return;

      try {
        MultiWalletStorage.updateWallet(userId, walletId, { isPrimary: true });
        loadWallets();
        
        // Track primary wallet change
        analytics.trackEvent('primary_wallet_changed', {
          wallet_id: walletId,
        });
        logWalletOperation("set_primary_wallet", "success", { walletId });
      } catch (err: any) {
        captureWalletError(err, "set_primary_wallet", { walletId, error: err.message });
        logWalletOperation("set_primary_wallet", "error", { error: err, walletId });
        setError(err.message || "Failed to set primary wallet");
      }
    },
    [userId, loadWallets]
  );

  const updateWallet = useCallback(
    (walletId: string, updates: Partial<MultiWalletRecord>) => {
      addWalletBreadcrumb("Updating wallet metadata", "wallet");
      
      if (!userId) return;

      try {
        MultiWalletStorage.updateWallet(userId, walletId, updates);
        loadWallets();
        logWalletOperation("update_wallet", "success", { walletId, updates });
      } catch (err: any) {
        captureWalletError(err, "update_wallet", { walletId, error: err.message });
        logWalletOperation("update_wallet", "error", { error: err, walletId });
        setError(err.message || "Failed to update wallet");
      }
    },
    [userId, loadWallets]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshWallets = useCallback(() => {
    loadWallets();
  }, [loadWallets]);

  const contextValue = useMemo(
    () => ({
      wallets,
      activeWallet,
      primaryWallet: primaryWalletState,
      isOperating,
      error,
      addWallet,
      removeWallet,
      switchWallet,
      setPrimaryWallet,
      updateWallet,
      clearError,
      refreshWallets,
    }),
    [wallets, activeWallet, primaryWalletState, isOperating, error, addWallet, removeWallet, switchWallet, setPrimaryWallet, updateWallet, clearError, refreshWallets]
  );

  return (
    <MultiWalletContext.Provider
      value={contextValue}
    >
      {children}
    </MultiWalletContext.Provider>
  );
}

/**
 * Helper function to migrate existing single-wallet storage to multi-wallet storage
 * Call this when upgrading from single-wallet to multi-wallet system
 */
export function migrateToMultiWallet(userId: string, existingWalletData: {
  publicKey: string;
  secretKey?: string;
  walletType: WalletProviderType;
  network?: "testnet" | "mainnet";
  chainId?: string;
}): void {
  try {
    MultiWalletStorage.migrateFromSingleWallet(userId, existingWalletData);
  } catch (err) {
    console.error("Failed to migrate to multi-wallet storage:", err);
  }
}
