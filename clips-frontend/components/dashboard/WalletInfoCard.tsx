"use client";

import React, { useState } from "react";
import { Wallet, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useAutoStellarWallet } from "@/app/hooks/useAutoStellarWallet";

/**
 * #337 – Web2-style wallet card.
 * Shows "My Wallet • X XLM" instead of raw public key.
 * Clean Venmo-style send form – no blockchain jargon visible by default.
 */
export default function WalletInfoCard() {
  const { publicKey, status, balance, error } = useAutoStellarWallet();

  const [sendOpen, setSendOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const xlmDisplay = balance
    ? `${parseFloat(balance.xlm).toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM`
    : status === "loading"
    ? "Loading…"
    : "— XLM";

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !amount) return;
    setSending(true);
    // PoC: simulate send delay
    await new Promise((r) => setTimeout(r, 1200));
    setSending(false);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setSendOpen(false);
      setRecipient("");
      setAmount("");
    }, 2000);
  };

  return (
    <div className="bg-surface border border-border rounded-[24px] p-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-brand" />
          </div>
          <div>
            <p className="text-[11px] text-muted font-medium uppercase tracking-wider">My Wallet</p>
            <p className="text-[22px] font-black text-white leading-tight">{xlmDisplay}</p>
          </div>
        </div>

        {/* Status badge */}
        {status === "ready" && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Wallet Ready
          </span>
        )}
        {status === "loading" && (
          <Loader2 className="w-4 h-4 text-muted animate-spin" />
        )}
        {status === "error" && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-error/10 border border-error/30 text-error text-[11px] font-bold">
            <AlertCircle className="w-3 h-3" />
            Error
          </span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-error text-[12px] mb-4">{error}</p>
      )}

      {/* USD sub-value */}
      {balance && (
        <p className="text-muted text-[13px] mb-5">≈ ${parseFloat(balance.usd).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD</p>
      )}

      {/* Send button */}
      {status === "ready" && !sendOpen && (
        <button
          onClick={() => setSendOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand font-bold text-[13px] transition-all"
        >
          <Send className="w-4 h-4" />
          Send XLM
        </button>
      )}

      {/* Send form – Venmo-style */}
      {sendOpen && (
        <form onSubmit={handleSend} className="space-y-3 mt-2">
          <div>
            <label className="block text-[11px] text-muted font-medium mb-1">To (username or address)</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. @alice or G…"
              required
              className="w-full bg-surface-hover border border-border rounded-xl px-4 py-2.5 text-[13px] text-white placeholder:text-muted focus:outline-none focus:border-brand/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted font-medium mb-1">Amount (XLM)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0.0000001"
              step="any"
              required
              className="w-full bg-surface-hover border border-border rounded-xl px-4 py-2.5 text-[13px] text-white placeholder:text-muted focus:outline-none focus:border-brand/50 transition-colors"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={sending || sent}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-black font-bold text-[13px] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sent ? (
                <><CheckCircle className="w-4 h-4" /> Sent!</>
              ) : sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              ) : (
                <><Send className="w-4 h-4" /> Send</>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setSendOpen(false); setRecipient(""); setAmount(""); }}
              className="px-4 py-2.5 rounded-xl border border-border text-muted hover:text-white text-[13px] font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* No wallet state */}
      {status === "idle" && !publicKey && (
        <p className="text-muted text-[13px]">
          Your Stellar wallet will appear here after login.
        </p>
      )}
    </div>
  );
}
