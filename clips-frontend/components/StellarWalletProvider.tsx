"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/useToast";

type StellarKitAny = any;

interface StellarState {
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
  kit: StellarKitAny | null;
}

interface StellarContext extends StellarState {
  connect?: () => Promise<void>;
  // `disconnect` accepts an optional `force` flag. When `force` is `false` (default)
  // the provider will prompt the user for confirmation before disconnecting.
  disconnect?: (force?: boolean) => void;
}

const defaultState: StellarState = {
  address: null,
  isConnected: false,
  isLoading: true,
  kit: null,
};

const StellarContext = createContext<StellarContext>({ ...defaultState });

export const useStellarWallet = () => useContext(StellarContext);

/**
 * StellarWalletProvider
 * - manages `address`, `isConnected`, `isLoading`
 * - initializes `StellarWalletsKit` with default modules (dynamic import)
 * - exposes `kit` on context when available
 */
export function StellarWalletProvider({ children }: { children: React.ReactNode }) {
  const { showToast, ToastEl } = useToast();
  const [address, setAddress] = useState<string | null>(defaultState.address);
  const [isConnected, setIsConnected] = useState<boolean>(defaultState.isConnected);
  const [isLoading, setIsLoading] = useState<boolean>(defaultState.isLoading);
  const [kit, setKit] = useState<StellarKitAny | null>(defaultState.kit);

  const kitRef = useRef<StellarKitAny | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initKit() {
      setIsLoading(true);

      // Default modules to initialize — include common Stellar wallets
      const defaultModules = ["freighter", "lobstr", "xbull", "injected", "walletconnect", "ledger"];

      try {
        // Try several possible package names, preferring the official scoped package.
        const pkgNames = ["@creit-tech/stellar-wallets-kit", "stellar-wallets-kit", "stellar-wallets"];
        let mod: any = null;
        let KitCtor: any = null;

        for (const name of pkgNames) {
          try {
            // eslint-disable-next-line no-await-in-loop
            mod = await import(name);
            if (mod) break;
          } catch (_) {
            // try next candidate
          }
        }

        KitCtor = mod?.StellarWalletsKit ?? mod?.default ?? null;

        if (KitCtor && typeof KitCtor === "function") {
          // Initialize kit with Testnet as requested by the acceptance criteria.
          const instance = new KitCtor({ modules: defaultModules, network: "testnet" });

          // If the kit exposes an async `init` method, call it.
          if (typeof instance.init === "function") {
            await instance.init();
          }

          if (!mounted) return;

          kitRef.current = instance;
          setKit(instance);
        } else {
          console.warn("StellarWalletsKit found but could not be instantiated (unexpected export shape).");
        }
      } catch (err) {
        // Library not installed or failed to load — not fatal
        console.warn("StellarWalletsKit could not be loaded:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initKit();

    return () => {
      mounted = false;
    };
  }, []);

  const connect = useCallback(async () => {
    if (!kitRef.current) {
      console.warn("Stellar kit not initialized. Cannot connect.");
      showToast("Wallet connector isn’t ready yet. Please refresh or try again shortly.", "error");
      return;
    }

    try {
      setIsLoading(true);

      // Attempt to call a generic `connect` on the kit. The actual API depends on the
      // installed library; we handle the common case where it returns an address.
      const res = await (kitRef.current.connect?.() ?? Promise.resolve(null));

      const newAddress = res?.address ?? res?.publicKey ?? null;

      if (newAddress) {
        setAddress(newAddress);
        setIsConnected(true);
      }
    } catch (err) {
      console.warn("Stellar connect failed:", err);
      const message = String((err as Error)?.message ?? err ?? "");
      const normalized = message.toLowerCase();
      let userMessage = "Failed to connect wallet. Please try again.";

      if (
        normalized.includes("no wallet") ||
        normalized.includes("wallet not installed") ||
        normalized.includes("extension not found") ||
        normalized.includes("provider not found")
      ) {
        userMessage = "No Stellar wallet was found. Install Freighter, Lobstr, or xBull and try again.";
      } else if (
        normalized.includes("user rejected") ||
        normalized.includes("user denied") ||
        normalized.includes("rejected") ||
        normalized.includes("cancelled") ||
        normalized.includes("cancelled by user")
      ) {
        userMessage = "Wallet connection was cancelled. Approve the request in your wallet to continue.";
      } else if (
        normalized.includes("network mismatch") ||
        normalized.includes("wrong network") ||
        normalized.includes("invalid network") ||
        (normalized.includes("testnet") && normalized.includes("public"))
      ) {
        userMessage = "Please switch your wallet to Stellar Testnet and try connecting again.";
      }

      showToast(userMessage, "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Default behaviour: show a confirmation dialog before disconnecting.
  // Call `disconnect(true)` to force a programmatic disconnect without prompting.
  const disconnect = useCallback((force = false) => {
    if (!force) {
      try {
        const confirmed = window.confirm("Disconnect wallet?");
        if (!confirmed) return;
      } catch (err) {
        // Non-browser environments may throw; fall through to disconnect.
      }
    }

    // If the kit provides a disconnect method attempt to call it.
    try {
      kitRef.current?.disconnect?.();
    } catch (err) {
      // ignore
    }

    setAddress(null);
    setIsConnected(false);
  }, []);

  return (
    <StellarContext.Provider value={{ address, isConnected, isLoading, kit, connect, disconnect }}>
      {children}
      {ToastEl}
    </StellarContext.Provider>
  );
}

export default StellarWalletProvider;
