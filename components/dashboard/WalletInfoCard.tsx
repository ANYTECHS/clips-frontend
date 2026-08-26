"use client";

import React, { useState, useCallback } from "react";
import { Wallet, Loader2, Droplets } from "lucide-react";
import { useAutoStellarWallet } from "@/app/hooks/useAutoStellarWallet";
import { useBalance } from "@/app/hooks/useBalance";
import { fundWithFriendbot } from "@/app/lib/stellar";
import { isTestnet, getFreighterNetwork, getStellarNetwork } from "@/app/lib/networkConfig";
import { useToast } from "@/hooks/useToast";

// IS_TESTNET guard — evaluated once at module load; safe because the network
// env var is baked in at build time and never changes at runtime.
const IS_TESTNET = isTestnet();

export default function WalletInfoCard() {
  const { publicKey, networkLabel } = useAutoStellarWallet();
  const { showToast, ToastEl } = useToast();
  const [isFunding, setIsFunding] = useState(false);

  const freighterNetwork = getFreighterNetwork(getStellarNetwork());
  const { refresh } = useBalance({
    publicKey,
    network: freighterNetwork,
    autoRefresh: false,
  });

  const handleFundWallet = useCallback(async () => {
    if (!publicKey || isFunding) return;

    setIsFunding(true);
    try {
      await fundWithFriendbot(publicKey);
      showToast("Testnet wallet funded with 10,000 XLM!", "success");

      // Give the ledger a moment to confirm before refreshing
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fund wallet. Please try again.";
      showToast(message, "error");
    } finally {
      setIsFunding(false);
    }
  }, [publicKey, isFunding, refresh, showToast]);

  // Only render on testnet — the IS_TESTNET guard ensures this card never
  // appears in production mainnet builds.
  if (!IS_TESTNET) return null;

  // No public key yet — nothing to show
  if (!publicKey) return null;

  return (
    <>
      <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Testnet Wallet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {networkLabel} &mdash; need XLM to test transactions?
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFundWallet}
          disabled={isFunding}
          aria-busy={isFunding}
          aria-label="Fund testnet wallet with Friendbot"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
            bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {isFunding ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Funding…
            </>
          ) : (
            <>
              <Droplets className="w-4 h-4" aria-hidden="true" />
              Fund Testnet Wallet
            </>
          )}
        </button>
      </div>

      {ToastEl}
    </>
  );
}
