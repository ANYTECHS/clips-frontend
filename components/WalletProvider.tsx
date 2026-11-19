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
  getCurrentNetwork,
  setNetwork,
} from "@/lib/wallet";
import type { NetworkId } from "@/lib/wallet";
import { KitEventType } from "@creit-tech/stellar-wallets-kit/types";

const STORAGE_KEY = "clipcash_wallet_address";

interface WalletContextType {
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  /** Active Stellar network ("testnet" | "mainnet"). */
  network: NetworkId;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  openProfile: () => Promise<void>;
  /**
   * Switches the active network. The wallet keypair is reused on the new
   * network (non-custodial — keys never leave the extension) and the connected
   * public key is preserved in localStorage. The page reloads so the kit
   * re-initialises on the new network.
   */
  switchNetwork: (target: NetworkId) => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnecting: false,
  error: null,
  network: "testnet",
  connect: async () => {},
  disconnect: async () => {},
  openProfile: async () => {},
  switchNetwork: () => {},
});

export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetworkState] = useState<NetworkId>(getCurrentNetwork());

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

  const switchNetwork = useCallback((target: NetworkId) => {
    if (target === network) return;
    // Persist the choice + update the active network id. We deliberately do
    // NOT clear `clipcash_wallet_address`: the same keypair is reused on the
    // new network, so the wallet stays connected and the keys (held by the
    // wallet extension) are preserved across the switch.
    setNetwork(target);
    setNetworkState(target);
    // The kit is bound to one network per page load — reload to re-init it on
    // the new network. The connected address is restored from localStorage on
    // the next load, so the user is not forced to reconnect.
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, [network]);

  return (
    <WalletContext.Provider
      value={{ address, isConnecting, error, network, connect, disconnect, openProfile, switchNetwork }}
    >
      {children}
    </WalletContext.Provider>
  );
}
