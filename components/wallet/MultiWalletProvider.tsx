"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  MultiWalletRecord,
  MultiWalletStorage,
  WalletProviderType,
} from "@/app/lib/multiWalletStorage";
import { useAuth } from "@/components/auth/AuthProvider";

// Analytics is optional — import lazily to avoid breaking tests that don't mock it
let analytics: { trackEvent: (name: string, props?: Record<string, unknown>) => void } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  analytics = require("@/lib/analytics").default;
} catch {}

interface MultiWalletContextValue {
  wallets: MultiWalletRecord[];
  activeWallet: MultiWalletRecord | null;
  primaryWallet: MultiWalletRecord | null;
  isOperating: boolean;
  error: string | null;
  addWallet: (
    data: Omit<MultiWalletRecord, "id" | "userId" | "createdAt" | "lastUsedAt">
  ) => Promise<MultiWalletRecord>;
  removeWallet: (walletId: string) => void;
  switchWallet: (walletId: string) => void;
  setPrimaryWallet: (walletId: string) => void;
  updateWallet: (walletId: string, updates: Partial<MultiWalletRecord>) => void;
  refreshWallets: () => void;
  clearError: () => void;
}

const MultiWalletContext = createContext<MultiWalletContextValue | null>(null);
MultiWalletContext.displayName = "MultiWalletContext";

export function MultiWalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<MultiWalletRecord[]>([]);
  const [isOperating, setIsOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWallets = useCallback(() => {
    if (!user?.id) {
      setWallets([]);
      return;
    }
    setWallets(MultiWalletStorage.getAll(user.id));
  }, [user?.id]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const activeWallet = wallets.find((w) => w.isActive) ?? null;
  const primaryWallet = wallets.find((w) => w.isPrimary) ?? null;

  const addWallet = useCallback(
    async (
      data: Omit<MultiWalletRecord, "id" | "userId" | "createdAt" | "lastUsedAt">
    ): Promise<MultiWalletRecord> => {
      if (!user?.id) throw new Error("User not authenticated");
      setIsOperating(true);
      try {
        const record = MultiWalletStorage.addWallet(user.id, data);
        setWallets(MultiWalletStorage.getAll(user.id));
        analytics?.trackEvent("wallet_added", { wallet_type: data.walletType });
        return record;
      } catch (err: any) {
        const msg = err?.message ?? "Failed to add wallet";
        setError(msg);
        throw err;
      } finally {
        setIsOperating(false);
      }
    },
    [user?.id]
  );

  const removeWallet = useCallback(
    (walletId: string) => {
      if (!user?.id) return;
      const target = wallets.find((w) => w.id === walletId);
      if (target?.isPrimary) {
        setError("Cannot remove primary wallet");
        return;
      }
      MultiWalletStorage.removeWallet(user.id, walletId);
      setWallets(MultiWalletStorage.getAll(user.id));
    },
    [user?.id, wallets]
  );

  const switchWallet = useCallback(
    (walletId: string) => {
      if (!user?.id) return;
      MultiWalletStorage.setActiveWallet(user.id, walletId);
      setWallets(MultiWalletStorage.getAll(user.id));
      analytics?.trackEvent("wallet_switched", { wallet_id: walletId });
    },
    [user?.id]
  );

  const setPrimaryWallet = useCallback(
    (walletId: string) => {
      if (!user?.id) return;
      MultiWalletStorage.updateWallet(user.id, walletId, { isPrimary: true });
      setWallets(MultiWalletStorage.getAll(user.id));
    },
    [user?.id]
  );

  const updateWallet = useCallback(
    (walletId: string, updates: Partial<MultiWalletRecord>) => {
      if (!user?.id) return;
      MultiWalletStorage.updateWallet(user.id, walletId, updates);
      setWallets(MultiWalletStorage.getAll(user.id));
    },
    [user?.id]
  );

  const refreshWallets = useCallback(() => {
    loadWallets();
  }, [loadWallets]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <MultiWalletContext.Provider
      value={{
        wallets,
        activeWallet,
        primaryWallet,
        isOperating,
        error,
        addWallet,
        removeWallet,
        switchWallet,
        setPrimaryWallet,
        updateWallet,
        refreshWallets,
        clearError,
      }}
    >
      {children}
    </MultiWalletContext.Provider>
  );
}

export function useMultiWallet(): MultiWalletContextValue {
  const ctx = useContext(MultiWalletContext);
  if (!ctx) throw new Error("useMultiWallet must be used inside <MultiWalletProvider>");
  return ctx;
}

/**
 * One-time migration from single-wallet to multi-wallet storage.
 * No-op if the user already has wallets.
 */
export function migrateToMultiWallet(
  userId: string,
  data: {
    publicKey: string;
    secretKey?: string;
    walletType: WalletProviderType;
    network?: "testnet" | "mainnet";
    chainId?: string;
  }
): void {
  MultiWalletStorage.migrateFromSingleWallet(userId, data);
}
