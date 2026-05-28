"use client";

/**
 * WalletStatusCard.tsx
 *
 * Dashboard card that shows the user's embedded Stellar wallet status.
 *
 * States:
 *  - No wallet yet (creation failed silently on signup) → shows "Create Wallet" CTA
 *  - Wallet exists → shows public key, network badge, copy button
 *  - Creating → shows spinner
 */

import React, { useState } from "react";
import { Wallet, Copy, CheckCheck, RefreshCw, ExternalLink, AlertCircle, Loader2 } from "lucide-react";
import { useEmbeddedWallet } from "@/components/EmbeddedWalletProvider";
import { truncateStellarAddress } from "@/app/lib/embeddedWallet";
import { useAuth } from "@/components/AuthProvider";

export default function WalletStatusCard() {
  const { user } = useAuth();
  const { wallet, isCreating, error, initWallet, clearError } = useEmbeddedWallet();
  const [copied, setCopied] = useState(false);

  // Prefer live wallet state; fall back to user record (persisted across refreshes)
  const publicKey = wallet?.publicKey ?? user?.walletAddress ?? null;
  const network = wallet?.network ?? user?.walletNetwork ?? "testnet";
  const walletType = wallet?.walletType ?? user?.walletType ?? null;

  const handleCopy = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = async () => {
    if (!user) return;
    await initWallet(user.id, "testnet");
  };

  const horizonUrl = network === "testnet"
    ? `https://stellar.expert/explorer/testnet/account/${publicKey}`
    : `https://stellar.expert/explorer/public/account/${publicKey}`;

  return (
    <div className="bg-[#0C1411] border border-[#1A2620] rounded-[20px] p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Wallet className="w-[18px] h-[18px] text-brand" />
          </div>
          <div>
            <div className="text-white font-bold text-[14px] leading-tight">Stellar Wallet</div>
            <div className="text-[#5A6F65] text-[11px] mt-0.5">
              {walletType === "embedded" ? "Auto-created · Embedded" :
               walletType === "freighter" ? "Freighter Extension" :
               walletType === "smart_contract" ? "Smart Contract Wallet" :
               "Not connected"}
            </div>
          </div>
        </div>

        {/* Network badge */}
        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          network === "testnet"
            ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
            : "bg-brand/10 border-brand/20 text-brand"
        }`}>
          {network}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div 
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2.5 bg-red-950/40 border border-red-500/20 rounded-[12px] px-4 py-3"
        >
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[12px] text-red-300 leading-snug flex-1">{error}</p>
          <button 
            onClick={clearError} 
            className="text-red-400 hover:text-red-200 transition-colors text-[11px] shrink-0"
            aria-label="Dismiss error message"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Wallet address or CTA */}
      {publicKey ? (
        <div className="bg-[#0A0F0D] border border-[#151D19] rounded-[12px] px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] text-[#4A5D54] font-bold uppercase tracking-wider mb-1">Public Key</div>
            <div className="font-mono text-[13px] text-white font-medium">
              {truncateStellarAddress(publicKey)}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              title="Copy full address"
              aria-label={copied ? "Address copied to clipboard" : "Copy full address to clipboard"}
              className="p-2 rounded-[8px] bg-[#131A17] border border-[#1E2A24] text-[#5A6F65] hover:text-brand hover:border-brand/30 transition-all"
            >
              {copied ? <CheckCheck className="w-3.5 h-3.5 text-brand" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>
            <a
              href={horizonUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="View on Stellar Explorer"
              aria-label="View wallet on Stellar Explorer (opens in new tab)"
              className="p-2 rounded-[8px] bg-[#131A17] border border-[#1E2A24] text-[#5A6F65] hover:text-brand hover:border-brand/30 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-[#5A6F65] leading-relaxed">
            Your wallet was not created during signup. Click below to create your embedded Stellar wallet — no extension required.
          </p>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            aria-busy={isCreating}
            aria-live="polite"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-[12px] bg-brand hover:bg-brand-hover text-black font-bold text-[13px] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Creating wallet…</>
            ) : (
              <><Wallet className="w-4 h-4" aria-hidden="true" /> Create My Wallet</>
            )}
          </button>
        </div>
      )}

      {/* Info footer */}
      {publicKey && (
        <div 
          className="flex items-center gap-2 text-[11px] text-[#3A4A43]"
          role="status"
          aria-live="polite"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-brand/60" aria-hidden="true" />
          Wallet auto-created on signup · Powered by Stellar
        </div>
      )}
    </div>
  );
}
