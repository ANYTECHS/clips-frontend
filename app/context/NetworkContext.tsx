"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getNftContractId, getStellarNetwork, type StellarNetwork } from "@/app/lib/networkConfig";
import { NetworkPreferenceStorage } from "@/app/lib/userPreferences";

const STORAGE_KEY = NetworkPreferenceStorage.getKey();

/** Window event fired whenever the active network changes in this tab. */
export const NETWORK_CHANGED_EVENT = "clipcash_network_changed";

type NetworkContextValue = {
  /**
   * Client-side value of NEXT_PUBLIC_STELLAR_NETWORK. The env var is inlined
   * at build time, so the runtime override lives here (and in
   * userPreferences) and every network-aware consumer reads it from context.
   */
  network: StellarNetwork;
  /** True when `network` is mainnet — real funds are in use. */
  isMainnet: boolean;
  /**
   * NFT contract for the active network: NEXT_PUBLIC_STELLAR_NFT_CONTRACT_ID
   * on testnet, NEXT_PUBLIC_STELLAR_NFT_CONTRACT_ID_MAINNET on mainnet.
   */
  contractId: string | undefined;
  /**
   * Incremented on every network switch. Wallet data hooks include it in
   * their effect dependencies so balances/history reload for the new network.
   */
  walletDataVersion: number;
  setNetwork: (n: StellarNetwork) => void;
};

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);
NetworkContext.displayName = "NetworkContext";

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetworkState] = useState<StellarNetwork>(() => getStellarNetwork());
  const [walletDataVersion, setWalletDataVersion] = useState(0);
  const networkRef = useRef(network);

  // Applies a network change coming from anywhere; bumps the reload counter
  // only when the network actually changed.
  const applyNetwork = useCallback((next: StellarNetwork) => {
    if (networkRef.current === next) return;
    networkRef.current = next;
    setNetworkState(next);
    setWalletDataVersion((v) => v + 1);
  }, []);

  // Sync from localStorage on mount (in case an external script changed it before React mounts)
  useEffect(() => {
    const stored = NetworkPreferenceStorage.get();
    if (stored) {
      networkRef.current = stored;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNetworkState(stored);
    }
  }, []);

  // Listen for storage events (cross-tab) and custom events to update state
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const val = (e.newValue as StellarNetwork) || getStellarNetwork();
        if (val === "testnet" || val === "mainnet") applyNetwork(val);
      }
    };

    const onCustom = () => applyNetwork(getStellarNetwork());

    window.addEventListener("storage", onStorage);
    window.addEventListener(NETWORK_CHANGED_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(NETWORK_CHANGED_EVENT, onCustom);
    };
  }, [applyNetwork]);

  const setNetwork = useCallback(
    (n: StellarNetwork) => {
      // Persists to userPreferences (wallet.defaultNetwork) and the override key.
      NetworkPreferenceStorage.set(n);
      applyNetwork(n);
      // Fire a custom event so same-tab listeners can react (storage does not fire in same tab)
      window.dispatchEvent(new Event(NETWORK_CHANGED_EVENT));
    },
    [applyNetwork]
  );

  const value = useMemo<NetworkContextValue>(
    () => ({
      network,
      isMainnet: network === "mainnet",
      contractId: getNftContractId(network),
      walletDataVersion,
      setNetwork,
    }),
    [network, walletDataVersion, setNetwork]
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkContext(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetworkContext must be used within NetworkProvider");
  return ctx;
}

/**
 * Like useNetworkContext, but returns undefined outside a NetworkProvider
 * (e.g. isolated Storybook stories) instead of throwing.
 */
export function useOptionalNetworkContext(): NetworkContextValue | undefined {
  return useContext(NetworkContext);
}
