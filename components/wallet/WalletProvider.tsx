"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { secureStorage } from "@/app/lib/secureStorage";

const STORAGE_KEY = "clipcash_wallet";

export type WalletType = "metamask" | "phantom" | "stellar" | "embedded" | "imported";

interface WalletState {
  address: string | null;
  chainId: string | null;
  walletType: WalletType | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  stellarSecret: string | null;
}

interface WalletContextValue extends WalletState {
  connectMetaMask: () => Promise<string | null>;
  connectPhantom: () => Promise<string | null>;
  connectStellar: () => Promise<string | null>;
  importStellarKey: (secret: string) => Promise<string | null>;
  disconnect: () => void;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);
WalletContext.displayName = "WalletContext";

const DEFAULT_STATE: WalletState = {
  address: null,
  chainId: null,
  walletType: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  stellarSecret: null,
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>(DEFAULT_STATE);

  // Restore persisted session on mount
  useEffect(() => {
    secureStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const data = JSON.parse(raw as string);
        setState((prev) => ({
          ...prev,
          address: data.address ?? null,
          chainId: data.chainId ?? null,
          walletType: data.walletType ?? null,
          isConnected: !!data.address,
        }));
      } catch {
        // Malformed — ignore
      }
    });
  }, []);

  // Register MetaMask event listeners
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;

    const onAccounts = (accounts: string[]) => {
      if (accounts.length === 0) {
        setState(DEFAULT_STATE);
        secureStorage.removeItem(STORAGE_KEY);
      } else {
        setState((prev) => ({ ...prev, address: accounts[0] }));
      }
    };
    const onChain = (chainId: string) => {
      setState((prev) => ({ ...prev, chainId }));
    };

    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener("accountsChanged", onAccounts);
      eth.removeListener("chainChanged", onChain);
    };
  }, []);

  // Register Phantom event listeners
  useEffect(() => {
    const sol = (window as any).solana;
    if (!sol) return;

    const onConnect = (publicKey: { toBase58: () => string }) => {
      const address = publicKey.toBase58();
      setState((prev) => ({ ...prev, address, isConnected: true, walletType: "phantom" }));
    };
    const onAccountChanged = (publicKey: { toBase58: () => string } | null) => {
      if (!publicKey) {
        setState(DEFAULT_STATE);
        secureStorage.removeItem(STORAGE_KEY);
      } else {
        setState((prev) => ({ ...prev, address: publicKey.toBase58() }));
      }
    };

    sol.on("connect", onConnect);
    sol.on("accountChanged", onAccountChanged);
    return () => {
      sol.removeListener("connect", onConnect);
      sol.removeListener("accountChanged", onAccountChanged);
    };
  }, []);

  const persist = useCallback(
    (address: string, chainId: string | null, walletType: WalletType) => {
      secureStorage.setItem(STORAGE_KEY, JSON.stringify({ address, chainId, walletType }));
    },
    []
  );

  const connectMetaMask = useCallback(async (): Promise<string | null> => {
    const eth = (window as any).ethereum;
    if (!eth) {
      setState((prev) => ({ ...prev, error: "MetaMask is not installed" }));
      return null;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) {
        setState((prev) => ({ ...prev, isConnecting: false, error: "No accounts returned" }));
        return null;
      }
      const address = accounts[0];
      let chainId: string | null = null;
      try {
        chainId = await eth.request({ method: "eth_chainId" });
      } catch {}

      setState({
        address,
        chainId,
        walletType: "metamask",
        isConnected: true,
        isConnecting: false,
        error: null,
        stellarSecret: null,
      });
      persist(address, chainId, "metamask");
      return address;
    } catch (err: any) {
      const msg = err?.code === 4001 ? "Connection rejected by user" : (err?.message ?? "Connection failed");
      setState((prev) => ({ ...prev, isConnecting: false, isConnected: false, error: msg }));
      return null;
    }
  }, [persist]);

  const connectPhantom = useCallback(async (): Promise<string | null> => {
    const sol = (window as any).solana;
    if (!sol?.isPhantom) {
      setState((prev) => ({ ...prev, error: "Phantom wallet not detected" }));
      return null;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));
    try {
      const resp = await sol.connect();
      const address: string = resp.publicKey.toBase58();

      setState({
        address,
        chainId: null,
        walletType: "phantom",
        isConnected: true,
        isConnecting: false,
        error: null,
        stellarSecret: null,
      });
      persist(address, null, "phantom");
      return address;
    } catch (err: any) {
      const msg = err?.code === 4001 ? "Connection rejected by user" : (err?.message ?? "Connection failed");
      setState((prev) => ({ ...prev, isConnecting: false, isConnected: false, error: msg }));
      return null;
    }
  }, [persist]);

  const connectStellar = useCallback(async (): Promise<string | null> => {
    // Stellar connection via Freighter or similar is handled externally;
    // this placeholder returns null. Real implementations can override via extension.
    setState((prev) => ({ ...prev, error: "Stellar connection not configured" }));
    return null;
  }, []);

  const importStellarKey = useCallback(async (secret: string): Promise<string | null> => {
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));
    try {
      // Derive address from secret key using Stellar SDK if available,
      // otherwise return the secret as a placeholder (real implementation resolves this via the SDK).
      const { Keypair } = await import("@stellar/stellar-sdk");
      const keypair = Keypair.fromSecret(secret);
      const address = keypair.publicKey();

      setState({
        address,
        chainId: "stellar",
        walletType: "imported",
        isConnected: true,
        isConnecting: false,
        error: null,
        stellarSecret: secret,
      });
      persist(address, "stellar", "imported");
      return address;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: err?.message ?? "Failed to import Stellar key",
      }));
      return null;
    }
  }, [persist]);

  const disconnect = useCallback(() => {
    const sol = (window as any).solana;
    if (sol && state.walletType === "phantom") {
      try { sol.disconnect(); } catch {}
    }
    setState(DEFAULT_STATE);
    secureStorage.removeItem(STORAGE_KEY);
  }, [state.walletType]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        connectMetaMask,
        connectPhantom,
        connectStellar,
        importStellarKey,
        disconnect,
        clearError,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
