"use client";

import React from "react";
import { Check, KeyRound, Sparkles, Wallet, X, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  STELLAR_WALLET_LABELS,
  STELLAR_WALLET_TYPES,
  type StellarWalletType,
} from "@/app/lib/multiWalletState";
import { sanitize } from "@/app/lib/sanitize";
import { truncateStellarAddress } from "@/app/lib/stringUtils";
import { useMultiWallet } from "@/components/wallet/MultiWalletProvider";

const WALLET_TYPE_ICONS: Record<StellarWalletType, LucideIcon> = {
  freighter: Wallet,
  albedo: Sparkles,
  xbull: Zap,
  passkey: KeyRound,
};

/**
 * Lists every connected Stellar wallet with its type icon and active state,
 * and lets the user switch the active wallet, disconnect wallets, or connect
 * another one (Issue #1219).
 */
export function WalletSwitcher() {
  const {
    connectedWallets,
    activeWalletId,
    connectWallet,
    disconnectWallet,
    setActiveWallet,
    isOperating,
    error,
  } = useMultiWallet();

  const handleConnect = (type: StellarWalletType) => {
    // Errors are surfaced through the provider's `error` state.
    connectWallet(type).catch(() => undefined);
  };

  return (
    <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 space-y-4">
      <h2 className="text-sm font-semibold text-white">Connected wallets</h2>

      {connectedWallets.length === 0 ? (
        <p className="text-xs text-zinc-400">No wallets connected.</p>
      ) : (
        <ul className="space-y-2" aria-label="Connected wallets">
          {connectedWallets.map((wallet) => {
            const Icon = WALLET_TYPE_ICONS[wallet.type];
            const isActive = wallet.id === activeWalletId;
            const label = sanitize(wallet.label);
            return (
              <li
                key={wallet.id}
                data-active={isActive}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  isActive ? "border-emerald-500/40 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <Icon className="w-5 h-5 text-zinc-300 shrink-0" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setActiveWallet(wallet.id)}
                  disabled={!wallet.isConnected}
                  aria-pressed={isActive}
                  aria-label={`Use ${label} wallet`}
                  className="flex-1 min-w-0 text-left"
                >
                  <span className="block text-sm font-medium text-white truncate">{label}</span>
                  <span className="block text-xs text-zinc-400 font-mono">
                    {truncateStellarAddress(wallet.publicKey)}
                  </span>
                </button>
                {isActive && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    Active
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => disconnectWallet(wallet.id)}
                  aria-label={`Disconnect ${label} wallet`}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {STELLAR_WALLET_TYPES.map((type) => {
          const Icon = WALLET_TYPE_ICONS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleConnect(type)}
              disabled={isOperating}
              className="flex items-center gap-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-2 text-xs font-medium text-white transition-colors"
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              Connect {STELLAR_WALLET_LABELS[type]}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {sanitize(error)}
        </p>
      )}
    </div>
  );
}
