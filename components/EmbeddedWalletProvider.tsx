"use client";

import { useSession } from "next-auth/react";
import React, { createContext, useCallback,useContext, useEffect, useState } from "react";

import { createEmbeddedWallet, EmbeddedWallet, getEmbeddedWallet } from "@/app/lib/embeddedWallet";
import { FAILURE_MESSAGES, safeErrorMessage } from "@/app/lib/errorMessages";

export interface EmbeddedWalletContextType {
  wallet: EmbeddedWallet | null;
  isLoading: boolean;
  error: string | null;
  refreshWallet: () => Promise<void>;
  createWallet: () => Promise<EmbeddedWallet | null>;
}

export const EmbeddedWalletContext = createContext<EmbeddedWalletContextType>({
  wallet: null,
  isLoading: true,
  error: null,
  refreshWallet: async () => {},
  createWallet: async () => null,
});

export function useEmbeddedWallet(): EmbeddedWalletContextType {
  const context = useContext(EmbeddedWalletContext);
  if (!context) {
    throw new Error("useEmbeddedWallet must be used within an EmbeddedWalletProvider");
  }
  return context;
}

export function EmbeddedWalletProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [wallet, setWallet] = useState<EmbeddedWallet | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const userId = (session?.user as { id?: string } | undefined)?.id;

  const refreshWallet = useCallback(async () => {
    // Prevent SSR window access
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    if (!userId) {
      setWallet(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const existingWallet = await getEmbeddedWallet(userId);
      if (existingWallet) {
        setWallet(existingWallet);
      } else {
        // Auto-create on first login if not found
        const res = await createEmbeddedWallet(userId);
        setWallet(res.wallet);
      }
    } catch (err) {
      setError(safeErrorMessage(err, FAILURE_MESSAGES.loadWallet, "load wallet"));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const createWallet = useCallback(async (): Promise<EmbeddedWallet | null> => {
    if (typeof window === "undefined" || !userId) return null;
    try {
      setIsLoading(true);
      setError(null);
      const res = await createEmbeddedWallet(userId);
      setWallet(res.wallet);
      return res.wallet;
    } catch (err) {
      setError(safeErrorMessage(err, FAILURE_MESSAGES.createWallet, "create wallet"));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status === "loading") {
      setIsLoading(true);
      return;
    }
    refreshWallet();
  }, [status, userId, refreshWallet]);

  return (
    <EmbeddedWalletContext.Provider
      value={{
        wallet,
        isLoading,
        error,
        refreshWallet,
        createWallet,
      }}
    >
      {children}
    </EmbeddedWalletContext.Provider>
  );
}
