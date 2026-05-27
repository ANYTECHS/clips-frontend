"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getBalance, Balance } from "./useBalance";

export type WalletStatus = "idle" | "ready" | "loading" | "error";

export interface AutoStellarWallet {
  publicKey: string | null;
  status: WalletStatus;
  balance: Balance | null;
  error: string | null;
}

/**
 * #335 – Automatically loads the user's Stellar wallet from auth context.
 * No manual connection required – shows "Wallet Ready" once the public key
 * is available on the authenticated user profile.
 */
export function useAutoStellarWallet(): AutoStellarWallet {
  const { user } = useAuth();
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derive public key from auth context (stored during signup/onboarding)
  const publicKey: string | null =
    (user?.profile?.stellarPublicKey as string) ?? null;

  useEffect(() => {
    if (!publicKey) {
      setStatus("idle");
      setBalance(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");

    getBalance(publicKey, "TESTNET")
      .then((bal) => {
        if (cancelled) return;
        setBalance(bal);
        setStatus("ready");
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        // Account not funded yet is still "ready" – wallet exists
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
  }, [publicKey]);

  return { publicKey, status, balance, error };
}
