"use client";

/**
 * WalletProvider
 *
 * Wraps the app and exposes wallet state (address, loading, error)
 * plus connect / disconnect helpers via the useWallet() hook.
 *
 * Persists the connected address in localStorage so the UI survives
 * a page refresh without forcing the user to reconnect.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  connectWalletModal,
  disconnectWallet,
  initWalletKit,
  openProfileModal,
  StellarWalletsKit,
} from "@/lib/wallet";
import { KitEventType } from "@creit-tech/stellar-wallets-kit/types";

const STORAGE_KEY = "clipcash_wallet_address";

interface WalletContextType {
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  openProfile: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnecting: false,
  error: null,
  connect: async () => {},
  disconnect: async () => {},
  openProfile: async () => {},
});

export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount: initialise the kit and restore persisted address
  useEffect(() => {
    initWalletKit();

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setAddress(stored);

    // Listen for kit-level state changes (wallet switch, disconnect)
    const unsub = StellarWalletsKit.on(
      KitEventType.STATE_UPDATED,
      ({ payload }) => {
        if (payload.address) {
          setAddress(payload.address);
          localStorage.setItem(STORAGE_KEY, payload.address);
        }
      }
    );

    const unsubDisconnect = StellarWalletsKit.on(
      KitEventType.DISCONNECT,
      () => {
        setAddress(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    );

    return () => {
      unsub();
      unsubDisconnect();
    };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const addr = await connectWalletModal();
      setAddress(addr);
      localStorage.setItem(STORAGE_KEY, addr);
    } catch (err: unknown) {
      // User closed the modal (-1) is not a real error
      const kitErr = err as { code?: number; message?: string };
      if (kitErr?.code !== -1) {
        setError(kitErr?.message ?? "Failed to connect wallet");
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    setAddress(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const openProfile = useCallback(async () => {
    await openProfileModal();
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, isConnecting, error, connect, disconnect, openProfile }}
    >
      {children}
    </WalletContext.Provider>
  );
}
