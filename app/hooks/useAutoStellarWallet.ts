"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getBalance, Balance } from "./useBalance";
import { getStellarNetwork, getFreighterNetwork, getActiveNetworkConfig } from "@/app/lib/networkConfig";

/** Current connection phase indicator for the managed auto-wallet context */
export type WalletStatus = "idle" | "ready" | "loading" | "error";

/** Interface defining properties returned from the automatic wallet resolution process */
export interface AutoStellarWallet {
  /** The derived public cryptographic address if authenticated, otherwise null */
  publicKey: string | null;
  /** Active Stellar network derived from NEXT_PUBLIC_STELLAR_NETWORK env var */
  network: "testnet" | "mainnet";
  /** Human-readable network label, e.g. "Testnet" or "Mainnet" */
  networkLabel: string;
  /** The current execution state machine status value */
  status: WalletStatus;
  /** Holds active balance amounts or null if not yet resolved */
  balance: Balance | null;
  /** Context description message details present only during failures */
  error: string | null;
}

/**
 * #335 – Automatically loads the user's Stellar wallet from auth context.
 * No manual connection required – shows "Wallet Ready" once the public key
 * is available on the authenticated user profile.
 *
 * Network is determined by the NEXT_PUBLIC_STELLAR_NETWORK environment variable:
 * - "testnet" (default) — uses Horizon testnet, balance fetched from testnet
 * - "mainnet"           — uses Horizon mainnet, balance fetched from mainnet
 * * @returns An updated AutoStellarWallet state block representing the active wallet condition metrics.
 */
export function useAutoStellarWallet(): AutoStellarWallet {
  const { user } = useAuth();
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derive public key from auth context (stored during signup/onboarding)
  const publicKey: string | null =
    (user?.profile?.stellarPublicKey as string) ?? null;

  // Resolve the Horizon-compatible network identifier from the env config
  const horizonNetwork = getFreighterNetwork(getStellarNetwork());

  useEffect(() => {
    if (!publicKey) {
      setStatus("idle");
      setBalance(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");

    getBalance(publicKey, horizonNetwork)
      .then((bal) => {
        if (cancelled) return;
        setBalance(bal);
        setStatus("ready");
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        // Account not funded yet is still "ready" – wallet exists but is inactive
        if (err?.code === "ACCOUNT_NOT_FOUND") {
          setStatus("ready");
          setError(null);
        } else {
          setStatus("error");
          setError(err?.message ?? "Failed to load wallet");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [publicKey, horizonNetwork]);

  return {
    publicKey,
    network: getStellarNetwork(),
    networkLabel: getActiveNetworkConfig().label,
    status,
    balance,
    error,
  };
}
