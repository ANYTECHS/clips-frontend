"use client";

import React from "react";
import { Loader2, Wallet, LogOut, AlertCircle, X } from "lucide-react";
import { useWallet, truncateAddress } from "./WalletProvider";

interface WalletConnectButtonProps {
  /** Compact mode renders a smaller pill button (e.g. for headers/navbars) */
  compact?: boolean;
}

export default function WalletConnectButton({ compact = false }: WalletConnectButtonProps) {
  const { isConnected, isConnecting, address, error, connectMetaMask, disconnect, clearError } =
    useWallet();

  if (compact) {
    return (
      <div className="relative flex flex-col items-end gap-2">
        {isConnected && address ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-xl px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-brand shadow-[0_0_6px_rgba(0,229,143,0.8)]" />
              <span className="text-[12px] font-mono font-bold text-brand">
                {truncateAddress(address)}
              </span>
            </div>
            <button
              onClick={disconnect}
              title="Disconnect wallet"
              className="p-2 rounded-xl bg-white/[0.03] border border-white/5 text-[#5A6F65] hover:text-red-400 hover:border-red-400/20 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={connectMetaMask}
            disabled={isConnecting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand/10 border border-brand/20 text-brand font-bold text-[13px] hover:bg-brand/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.97]"
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wallet className="w-4 h-4" />
            )}
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}

        {/* Inline error toast */}
        {error && (
          <div className="absolute top-full mt-2 right-0 z-50 flex items-start gap-2 bg-red-950/80 border border-red-500/30 rounded-xl px-4 py-3 max-w-[280px] shadow-xl backdrop-blur-md">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-300 leading-snug flex-1">{error}</p>
            <button onClick={clearError} className="text-red-400 hover:text-red-200 transition-colors shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full-size variant (used in platform cards / standalone pages)
  return (
    <div className="flex flex-col gap-3 w-full">
      {error && (
        <div className="flex items-start gap-2.5 bg-red-950/60 border border-red-500/25 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[13px] text-red-300 leading-snug flex-1">{error}</p>
          <button onClick={clearError} className="text-red-400 hover:text-red-200 transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isConnected && address ? (
        <button
          onClick={disconnect}
          className="w-full py-4 rounded-xl font-bold text-[14px] bg-transparent border border-white/10 text-white hover:bg-red-950/30 hover:border-red-500/30 hover:text-red-400 transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4" />
          Disconnect
        </button>
      ) : (
        <button
          onClick={connectMetaMask}
          disabled={isConnecting}
          className="w-full py-4 rounded-xl font-bold text-[14px] bg-brand hover:bg-brand-hover text-black shadow-[0_0_20px_rgba(0,229,143,0.2)] hover:shadow-[0_0_35px_rgba(0,229,143,0.35)] transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Wallet className="w-4 h-4" />
          )}
          {isConnecting ? "Connecting..." : "Connect MetaMask"}
        </button>
      )}
    </div>
  );
}
