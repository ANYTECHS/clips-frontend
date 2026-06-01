"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "./WalletProvider";
import { Coins, Send, AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import TransactionConfirmationModal from "./TransactionConfirmationModal";
import { formatXLMAmount } from "@/app/lib/formatAmount";

export default function SendPaymentForm() {
  const {
    isConnected,
    walletType,
    address,
    balance,
    fundWithFriendbot,
    refreshBalance,
    isConnecting,
  } = useWallet();

  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [funding, setFunding] = useState(false);
  const [fundingSuccess, setFundingSuccess] = useState(false);

  // Modal State
  const [showConfirm, setShowConfirm] = useState(false);

  const isStellar = isConnected && walletType === "stellar";

  // Validate address format
  const isValidStellarAddress = (addr: string) => {
    return /^G[A-D2-7][A-Z2-7]{54}$/.test(addr);
  };

  const handleMaxClick = () => {
    if (!balance) return;
    const balNum = parseFloat(balance);
    // Keep 0.1 XLM for fees/reserve
    const maxAmount = Math.max(0, balNum - 0.1);
    setAmount(maxAmount.toFixed(4));
  };

  const handleSendClick = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!destination) {
      setError("Destination address is required.");
      return;
    }

    if (!isValidStellarAddress(destination)) {
      setError("Invalid Stellar destination address. It must start with 'G' and be 56 characters long.");
      return;
    }

    if (destination === address) {
      setError("Cannot send payments to your own address.");
      return;
    }

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }

    const balNum = parseFloat(balance || "0");
    if (amtNum > balNum) {
      setError(`Insufficient balance. You have ${balNum} XLM, but tried to send ${amtNum} XLM.`);
      return;
    }

    // Validation passes, open confirmation modal
    setShowConfirm(true);
  };

  const handleFundAccount = async () => {
    setFunding(true);
    setFundingSuccess(false);
    setError("");
    try {
      await fundWithFriendbot();
      setFundingSuccess(true);
      setTimeout(() => setFundingSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || "Failed to fund account using Friendbot.");
    } finally {
      setFunding(false);
    }
  };

  if (!isStellar) {
    return (
      <div className="bg-surface/60 border border-white/5 rounded-3xl p-8 text-center backdrop-blur-md">
        <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-4">
          <Coins className="w-8 h-8 text-brand" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Stellar Wallet Not Connected</h3>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
          To send XLM payments and configure transactions on the Stellar network, please connect your Stellar wallet first.
        </p>
      </div>
    );
  }

  const isAccountUnfunded = parseFloat(balance || "0") === 0;

  return (
    <div className="bg-surface/80 border border-white/5 rounded-[24px] p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Decorative top gradient */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand/20 via-brand to-brand/20" />
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white">Send Stellar Payment</h3>
            <p className="text-xs text-muted-foreground">Transfer XLM instantly across the globe</p>
          </div>
        </div>

        <button
          onClick={() => refreshBalance()}
          disabled={isConnecting}
          className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground hover:text-white transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
          title="Refresh Balance"
        >
          <RefreshCw className={`w-4 h-4 ${isConnecting ? "animate-spin text-brand" : ""}`} />
        </button>
      </div>

      {isAccountUnfunded && (
        <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-white">Unfunded Wallet</p>
              <p className="text-[11px] text-yellow-400/80 leading-snug">
                Your Stellar account has 0 XLM. On Testnet, you can fund it instantly using Friendbot.
              </p>
            </div>
          </div>
          <button
            onClick={handleFundAccount}
            disabled={funding}
            className="px-3.5 py-1.5 rounded-lg bg-yellow-500 text-black text-xs font-extrabold hover:bg-yellow-400 transition-all cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-50"
          >
            {funding ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Funding...</>
            ) : fundingSuccess ? (
              "Funded! +10k XLM"
            ) : (
              "Fund via Friendbot"
            )}
          </button>
        </div>
      )}

      <form onSubmit={handleSendClick} className="space-y-5">
        <div>
          <label htmlFor="destination" className="block text-[12px] font-bold text-muted-foreground tracking-wider uppercase mb-2">
            Recipient Address
          </label>
          <input
            id="destination"
            type="text"
            placeholder="G..."
            value={destination}
            onChange={(e) => setDestination(e.target.value.trim())}
            className="w-full bg-input border border-white/5 text-white focus:border-brand/50 rounded-xl px-4 py-3.5 text-[14px] font-mono focus:outline-none transition-colors"
          />
          {destination && !isValidStellarAddress(destination) && (
            <span className="text-[11px] text-red-400 mt-1.5 block">
              Invalid Stellar public key format. Must start with G and be 56 characters.
            </span>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="amount" className="block text-[12px] font-bold text-muted-foreground tracking-wider uppercase">
              Amount (XLM)
            </label>
            <button
              type="button"
              onClick={handleMaxClick}
              className="text-[11px] font-bold text-brand hover:underline cursor-pointer"
            >
              Use Max (Fee Buffer)
            </button>
          </div>
          <div className="relative">
            <input
              id="amount"
              type="number"
              step="any"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-input border border-white/5 text-white focus:border-brand/50 rounded-xl px-4 py-3.5 text-[14px] font-mono focus:outline-none transition-colors pr-16"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold font-sans">
              XLM
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1.5 block">
            Wallet Balance: <span className="text-white font-mono">{balance ? formatXLMAmount(balance, 4) : "0.00"} XLM</span>
          </span>
        </div>

        <div>
          <label htmlFor="memo" className="block text-[12px] font-bold text-muted-foreground tracking-wider uppercase mb-2">
            Memo (Optional)
          </label>
          <input
            id="memo"
            type="text"
            placeholder="Transaction memo"
            maxLength={28}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full bg-input border border-white/5 text-white focus:border-brand/50 rounded-xl px-4 py-3.5 text-[14px] focus:outline-none transition-colors"
          />
          <span className="text-[10px] text-muted-foreground mt-1.5 block">
            Max 28 characters. Standard text memo.
          </span>
        </div>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-center">
            <span className="text-xs text-red-400 font-semibold">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isAccountUnfunded}
          className="w-full py-4 rounded-xl bg-brand hover:bg-brand-hover text-black font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,229,143,0.1)] hover:shadow-[0_0_30px_rgba(0,229,143,0.25)]"
        >
          <span>Continue to Confirmation</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Confirmation Modal */}
      {showConfirm && (
        <TransactionConfirmationModal
          recipient={destination}
          amount={amount}
          memo={memo}
          onClose={() => setShowConfirm(false)}
          onSuccess={() => {
            setShowConfirm(false);
            setDestination("");
            setAmount("");
            setMemo("");
          }}
        />
      )}
    </div>
  );
}
