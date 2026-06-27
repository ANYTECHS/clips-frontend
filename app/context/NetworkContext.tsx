"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getStellarNetwork, type StellarNetwork } from "@/app/lib/networkConfig";
import { NetworkPreferenceStorage } from "@/app/lib/userPreferences";

const STORAGE_KEY = NetworkPreferenceStorage.getKey();

type NetworkContextValue = {
  network: StellarNetwork;
  setNetwork: (n: StellarNetwork) => void;
};

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);
NetworkContext.displayName = "NetworkContext";

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetworkState] = useState<StellarNetwork>(() => getStellarNetwork());

  // Sync from localStorage on mount (in case an external script changed it before React mounts)
  useEffect(() => {
    const stored = NetworkPreferenceStorage.get();
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNetworkState(stored);
    }
  }, []);

  // Listen for storage events (cross-tab) and custom events to update state
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const val = (e.newValue as StellarNetwork) || getStellarNetwork();
        if (val === "testnet" || val === "mainnet") setNetworkState(val);
      }
    };

    const onCustom = () => setNetworkState(getStellarNetwork());

    window.addEventListener("storage", onStorage);
    window.addEventListener("clipcash_network_changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("clipcash_network_changed", onCustom);
    };
  }, []);

  const setNetwork = useCallback((n: StellarNetwork) => {
    NetworkPreferenceStorage.set(n);
    setNetworkState(n);
    // Fire a custom event so same-tab listeners can react (storage does not fire in same tab)
    window.dispatchEvent(new Event("clipcash_network_changed"));
  }, []);

  return <NetworkContext.Provider value={{ network, setNetwork }}>{children}</NetworkContext.Provider>;
}

export function useNetworkContext(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetworkContext must be used within NetworkProvider");
  return ctx;
}
