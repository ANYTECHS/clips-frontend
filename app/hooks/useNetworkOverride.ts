"use client";

import { useState, useEffect } from "react";
import { STELLAR_NETWORK, type StellarNetwork } from "@/app/lib/networkConfig";

const STORAGE_KEY = "clipcash_network_override";

/**
 * Runtime network override stored in localStorage.
 * Falls back to the env-var default (NEXT_PUBLIC_STELLAR_NETWORK).
 * A page reload is required for the override to fully propagate to all
 * hooks that read from networkConfig at module initialisation time.
 */
export function useNetworkOverride() {
  const [network, setNetworkState] = useState<StellarNetwork>(STELLAR_NETWORK);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as StellarNetwork | null;
    if (stored === "testnet" || stored === "mainnet") {
      setNetworkState(stored);
    }
  }, []);

  const setNetwork = (next: StellarNetwork) => {
    localStorage.setItem(STORAGE_KEY, next);
    setNetworkState(next);
    // Reload so all module-level networkConfig reads pick up the new value
    window.location.reload();
  };

  return { network, setNetwork };
}
