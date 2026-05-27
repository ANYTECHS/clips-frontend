"use client";

/**
 * EmbeddedWalletProvider.tsx
 *
 * React context provider for the embedded Stellar wallet (Web2 flow).
 *
 * This provider:
 *  - Exposes the current user's embedded wallet state
 *  - Provides `initWallet(userId)` to trigger wallet creation (called on signup)
 *  - Provides `refreshWallet(userId)` to reload wallet state from storage
 *  - Integrates with the existing AuthProvider user lifecycle
 *
 * Usage:
 *   const { wallet, isCreating, error, initWallet } = useEmbeddedWallet();
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  createEmbeddedWallet,
  getEmbeddedWallet,
  EmbeddedWallet,
  StellarNetwork,
} from "@/app/lib/embeddedWallet";

// ─── Context types ─────────────────────────────────────────────────────────────

interface EmbeddedWalletContextType {
  /** The current user's embedded wallet, or null if not yet created */
  wallet: EmbeddedWallet | null;
  /** True while wallet creation is in progress */
  isCreating: boolean;
  /** Error message if wallet creation failed */
  error: string | null;
  /**
   * Create (or retrieve) an embedded wallet for the given userId.
   * Safe to call multiple times — idempotent.
   */
  initWallet: (userId: string, network?: StellarNetwork) => Promise<EmbeddedWallet | null>;
  /**
   * Reload wallet state from storage (e.g. after page refresh).
   */
  refreshWallet: (userId: string) => void;
  /** Clear any error state */
  clearError: () => void;
}

const EmbeddedWalletContext = createContext<EmbeddedWalletContextType>({
  wallet: null,
  isCreating: false,
  error: null,
  initWallet: async () => null,
  refreshWallet: () => {},
  clearError: () => {},
});

export const useEmbeddedWallet = () => useContext(EmbeddedWalletContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface EmbeddedWalletProviderProps {
  children: React.ReactNode;
  /** If provided, the provider will auto-load the wallet for this userId on mount */
  userId?: string | null;
}

export function EmbeddedWalletProvider({ children, userId }: EmbeddedWalletProviderProps) {
  const [wallet, setWallet] = useState<EmbeddedWallet | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-load wallet from storage when userId is available
  useEffect(() => {
    if (userId) {
      const stored = getEmbeddedWallet(userId);
      if (stored) setWallet(stored);
    } else {
      setWallet(null);
    }
  }, [userId]);

  const initWallet = useCallback(
    async (uid: string, network: StellarNetwork = "testnet"): Promise<EmbeddedWallet | null> => {
      setIsCreating(true);
      setError(null);
      try {
        const result = await createEmbeddedWallet(uid, network, true);
        setWallet(result.wallet);
        return result.wallet;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to create wallet. Please try again.";
        setError(message);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const refreshWallet = useCallback((uid: string) => {
    const stored = getEmbeddedWallet(uid);
    setWallet(stored);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <EmbeddedWalletContext.Provider
      value={{ wallet, isCreating, error, initWallet, refreshWallet, clearError }}
    >
      {children}
    </EmbeddedWalletContext.Provider>
  );
}
