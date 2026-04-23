"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// EIP-1193 provider type (window.ethereum)
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export type WalletType = "metamask" | "phantom";

export interface WalletState {
  address: string | null;
  chainId: string | null;
  walletType: WalletType | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

interface WalletContextType extends WalletState {
  connectMetaMask: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
}

const STORAGE_KEY = "clipcash_wallet";

const defaultState: WalletState = {
  address: null,
  chainId: null,
  walletType: null,
  isConnected: false,
  isConnecting: false,
  error: null,
};

const WalletContext = createContext<WalletContextType>({
  ...defaultState,
  connectMetaMask: async () => {},
  disconnect: () => {},
  clearError: () => {},
});

export const useWallet = () => useContext(WalletContext);

/** Truncate a wallet address for display: 0x1234...5678 */
export function truncateAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>(defaultState);

  // Restore persisted session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Partial<WalletState> = JSON.parse(stored);
        if (parsed.address && parsed.walletType) {
          setState((prev) => ({
            ...prev,
            address: parsed.address!,
            chainId: parsed.chainId ?? null,
            walletType: parsed.walletType!,
            isConnected: true,
          }));
        }
      }
    } catch {
      // Ignore malformed storage
    }
  }, []);

  // Listen for MetaMask account / chain changes
  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (!accs || accs.length === 0) {
        // User disconnected from MetaMask side
        handleDisconnect();
      } else {
        const address = accs[0];
        setState((prev) => ({ ...prev, address }));
        persistSession({ address, chainId: state.chainId, walletType: "metamask" });
      }
    };

    const handleChainChanged = (chainId: unknown) => {
      const id = chainId as string;
      setState((prev) => ({ ...prev, chainId: id }));
      persistSession({ address: state.address, chainId: id, walletType: state.walletType });
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.address, state.chainId, state.walletType]);

  function persistSession(data: { address: string | null; chainId: string | null; walletType: WalletType | null }) {
    if (data.address) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function handleDisconnect() {
    setState({ ...defaultState });
    localStorage.removeItem(STORAGE_KEY);
  }

  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum || !window.ethereum.isMetaMask) {
      setState((prev) => ({
        ...prev,
        error: "MetaMask is not installed. Please install the MetaMask browser extension.",
      }));
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned. Please unlock MetaMask and try again.");
      }

      const chainId = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      const address = accounts[0];

      setState({
        address,
        chainId,
        walletType: "metamask",
        isConnected: true,
        isConnecting: false,
        error: null,
      });

      persistSession({ address, chainId, walletType: "metamask" });
    } catch (err: unknown) {
      const message =
        (err as { code?: number; message?: string })?.code === 4001
          ? "Connection rejected. Please approve the request in MetaMask."
          : (err as Error)?.message ?? "Failed to connect wallet. Please try again.";

      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: message,
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    handleDisconnect();
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return (
    <WalletContext.Provider
      value={{ ...state, connectMetaMask, disconnect, clearError }}
    >
      {children}
    </WalletContext.Provider>
  );
}
