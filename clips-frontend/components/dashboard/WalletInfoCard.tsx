"use client";

import React, { useState } from "react";
import { Wallet, ExternalLink, Copy, Check, AlertCircle } from "lucide-react";
import { useWalletConnection } from "@/app/hooks/useWalletConnection";
import BalanceDisplay from "@/components/wallet/BalanceDisplay";

export default function WalletInfoCard() {
  const {
    connect,
    disconnect,
    isConnecting,
    isConnected,
    publicKey,
    network,
    error: walletError,
    getTruncatedAddress,
  } = useWalletConnection();

  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!publicKey) return;

    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  const handleViewOnExplorer = () => {
    if (!publicKey) return;

    const explorerUrl =
      network === "PUBLIC"
        ? `https://stellar.expert/explorer/public/account/${publicKey}`
        : `https://stellar.expert/explorer/testnet/account/${publicKey}`;

    window.open(explorerUrl, "_blank", "noopener,noreferrer");
  };

  if (!isConnected) {
    return (
      <div className="bg-surface border border-border rounded-[24px] p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-bold text-white mb-1">
              Stellar Wallet
            </h3>
            <p className="text-[13px] text-muted mb-4">
              Connect your Freighter wallet to view your balance and manage transactions
            </p>
            <button
              onClick={connect}
              disabled={isConnecting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand font-bold text-[13px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  Connect Wallet
                </>
              )}
            </button>
          </div>
        </div>

        {walletError && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-error/10 border border-error/30 rounded-xl">
            <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
            <p className="text-error text-[12px] leading-relaxed">
              {walletError.message}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-[24px] p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-bold text-white mb-1">
              Stellar Wallet
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-muted font-mono">
                {getTruncatedAddress(publicKey!)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopyAddress}
                  className="p-1 rounded hover:bg-surface-hover transition-colors"
                  title="Copy full address"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-brand" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted hover:text-white" />
                  )}
                </button>
                <button
                  onClick={handleViewOnExplorer}
                  className="p-1 rounded hover:bg-surface-hover transition-colors"
                  title="View on Stellar Explorer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted hover:text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={disconnect}
          className="text-[12px] text-muted hover:text-error font-medium transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Network Badge */}
      <div className="mb-4">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
            network === "PUBLIC"
              ? "bg-brand/10 text-brand border border-brand/20"
              : "bg-warning/10 text-warning border border-warning/20"
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              network === "PUBLIC" ? "bg-brand" : "bg-warning"
            }`}
          />
          {network === "PUBLIC" ? "Mainnet" : "Testnet"}
        </span>
      </div>

      {/* Balance Display with Auto-refresh */}
      <BalanceDisplay
        publicKey={publicKey}
        network={network}
        refreshInterval={30000} // 30 seconds
        autoRefresh={true}
        mode="full"
        showLastUpdate={true}
        showRefreshButton={true}
      />

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleViewOnExplorer}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-surface-hover hover:bg-border border border-border text-white font-medium text-[12px] transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Explorer
          </button>
        </div>
      </div>
    </div>
  );
}
