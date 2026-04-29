"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { secureStorage } from "@/app/lib/secureStorage";

// EIP-1193 provider type (window.ethereum)
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toBase58: () => string } }>;
      disconnect: () => Promise<void>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      publicKey?: {
        toBase58: () => string;
      };
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
  connectPhantom: () => Promise<void>;
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
  connectPhantom: async () => {},
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
  const stateRef = useRef(state);

  // Sync ref with state so event listeners always see latest values
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Restore persisted session on mount
  useEffect(() => {
    try {
      secureStorage.getItem(STORAGE_KEY).then((stored) => {
        if (stored) {
          const parsed: Partial<WalletState> = JSON.parse(stored);
          if (parsed.address && parsed.walletType) {
            setState((prev: WalletState) => ({
              ...prev,
              address: parsed.address!,
              chainId: parsed.chainId ?? null,
              walletType: parsed.walletType!,
              isConnected: true,
            }));
          }
        }
      });
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
        setState((prev: WalletState) => ({ ...prev, address }));
        persistSession({ address, chainId: stateRef.current.chainId, walletType: "metamask" });
      }
    };

    const handleChainChanged = (chainId: unknown) => {
      const id = chainId as string;
      setState((prev: WalletState) => ({ ...prev, chainId: id }));
      persistSession({ address: stateRef.current.address, chainId: id, walletType: stateRef.current.walletType });
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  // Listen for Solana account changes
  useEffect(() => {
    const solana = window.solana;
    if (!solana) return;

    const handleAccountChanged = (publicKey: { toBase58: () => string } | null) => {
      if (!publicKey) {
        handleDisconnect();
      } else {
        const address = publicKey.toBase58();
        setState((prev: WalletState) => ({ ...prev, address }));
        persistSession({ address, chainId: "5EJ9Vc47M3VvM2x6wCk3F2nZ3qG7yB9rD6aX8cE5fG1h", walletType: "phantom" });
      }
    };

    const handleConnect = (publicKey: { toBase58: () => string }) => {
      const address = publicKey.toBase58();
      setState((prev: WalletState) => ({
        ...prev,
        address,
        isConnected: true,
        isConnecting: false,
        error: null,
      }));
      persistSession({ address, chainId: "5EJ9Vc47M3VvM2x6wCk3F2nZ3qG7yB9rD6aX8cE5fG1h", walletType: "phantom" });
    };

    solana.on("accountChanged", handleAccountChanged);
    solana.on("connect", handleConnect);

    return () => {
      solana.removeListener("accountChanged", handleAccountChanged);
      solana.removeListener("connect", handleConnect);
    };
  }, []);

  function persistSession(data: { address: string | null; chainId: string | null; walletType: WalletType | null }) {
    if (data.address) {
      secureStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      secureStorage.removeItem(STORAGE_KEY);
    }
  }

  function handleDisconnect() {
    setState({ ...defaultState });
    secureStorage.removeItem(STORAGE_KEY);
    
    // Disconnect from Phantom if connected
    const solana = window.solana;
    if (solana && state.walletType === "phantom") {
      solana.disconnect().catch(() => {});
    }
  }

  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum || !window.ethereum.isMetaMask) {
      setState((prev: WalletState) => ({
        ...prev,
        error: "MetaMask is not installed. Please install the MetaMask browser extension.",
      }));
      return;
    }

    setState((prev: WalletState) => ({ ...prev, isConnecting: true, error: null }));

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

      setState((prev: WalletState) => ({
        ...prev,
        isConnecting: false,
        error: message,
      }));
    }
  }, []);

  const connectPhantom = useCallback(async () => {
    const solana = window.solana;
    if (!solana || !solana.isPhantom) {
      setState((prev: WalletState) => ({
        ...prev,
        error: "Phantom wallet not detected. Please install the Phantom browser extension.",
      }));
      return;
    }

    setState((prev: WalletState) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const response = await solana.connect();
      const address = response.publicKey.toBase58();

      setState({
        address,
        chainId: "5EJ9Vc47M3VvM2x6wCk3F2nZ3qG7yB9rD6aX8cE5fG1h",
        walletType: "phantom",
        isConnected: true,
        isConnecting: false,
        error: null,
      });

      persistSession({ address, chainId: "5EJ9Vc47M3VvM2x6wCk3F2nZ3qG7yB9rD6aX8cE5fG1h", walletType: "phantom" });
    } catch (err: unknown) {
      const message =
        (err as { code?: number; message?: string })?.code === 4001
          ? "Connection rejected. Please approve the request in Phantom."
          : (err as Error)?.message ?? "Failed to connect Phantom wallet. Please try again.";

      setState((prev: WalletState) => ({
        ...prev,
        isConnecting: false,
        error: message,
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    handleDisconnect();
  }, [state.walletType]);

  const clearError = useCallback(() => {
    setState((prev: WalletState) => ({ ...prev, error: null }));
  }, []);

  return (
    <WalletContext.Provider
      value={{ ...state, connectMetaMask, connectPhantom, disconnect, clearError }}
    >
      {children}
    </WalletContext.Provider>
  );
}
