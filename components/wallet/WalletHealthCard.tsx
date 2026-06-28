"use client";

import { useAutoStellarWallet } from "@/app/hooks/useAutoStellarWallet";
import { Loader2, CheckCircle2, AlertCircle, Wallet } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  ACCOUNT_NOT_FOUND:
    "Your wallet hasn't been funded yet. Add XLM to activate it.",
  FETCH_ERROR: "Unable to load wallet data. Check your connection.",
  UNKNOWN_ERROR: "An unexpected error occurred.",
};

interface WalletHealthCardProps {
  publicKey: string | null;
}

export default function WalletHealthCard({ publicKey }: WalletHealthCardProps) {
  const { status, error, balance, networkLabel } = useAutoStellarWallet();

  if (!publicKey) {
    return null;
  }

  const displayError =
    status === "ready" && !balance
      ? ERROR_MESSAGES.ACCOUNT_NOT_FOUND
      : status === "error" && error
        ? ERROR_MESSAGES.UNKNOWN_ERROR
        : null;

  return (
    <div className="bg-surface border border-border rounded-[24px] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Wallet Health</h3>
        {status === "loading" && (
          <Loader2 className="w-4 h-4 text-brand animate-spin" />
        )}
        {status === "ready" && !displayError && (
          <CheckCircle2 className="w-4 h-4 text-brand" />
        )}
        {(displayError) && <AlertCircle className="w-4 h-4 text-error" />}
        {status === "idle" && <Wallet className="w-4 h-4 text-muted" />}
      </div>

      {status === "loading" && (
        <p className="text-muted text-[13px]">Loading wallet data...</p>
      )}

      {status === "idle" && (
        <p className="text-muted text-[13px]">No wallet connected.</p>
      )}

      {status === "ready" && !displayError && balance && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted text-[12px]">Balance</span>
            <span className="text-white font-bold">{balance.xlm} XLM</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted text-[12px]">USD Value</span>
            <span className="text-white font-bold">{balance.usd}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted text-[12px]">Network</span>
            <span className="text-white font-bold">{networkLabel}</span>
          </div>
        </div>
      )}

      {displayError && (
        <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-[13px]">{displayError}</p>
        </div>
      )}
    </div>
  );
}
