"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Wallet, ExternalLink, Copy, Check, AlertCircle, Send, Loader2, CheckCircle, Activity } from "lucide-react";
import { useWalletConnection } from "@/app/hooks/useWalletConnection";
import { useAutoStellarWallet } from "@/app/hooks/useAutoStellarWallet";
import ActivityFeed from "@/components/wallet/ActivityFeed";

/**
 * #337 – Web2-style wallet card.
 * Shows "My Wallet • X XLM" instead of raw public key.
 * Clean Venmo-style send form – no blockchain jargon visible by default.
 */
export default function WalletInfoCard() {
  const { publicKey, status, balance, error, network } = useAutoStellarWallet();
  const { stellarSecret, refreshBalance } = useWallet();
  const formRef = useRef<HTMLFormElement>(null);
  const recipientInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const [sendOpen, setSendOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const recipientId = React.useId();
  const amountId = React.useId();
  const errorId = React.useId();
  const successId = React.useId();

  const xlmDisplay = balance
    ? formatXLM(balance.xlm, { decimals: 2, includeCurrency: true })
    : status === "loading"
    ? "Loading…"
    : "— XLM";

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!recipient || !amount) {
      setFormError("Please fill in all fields");
      return;
    }
    
    if (parseFloat(amount) <= 0) {
      setFormError("Amount must be greater than 0");
      return;
    }
    
    setSending(true);
    // PoC: simulate send delay
    await new Promise((r) => setTimeout(r, 1200));
    setSending(false);
    setSent(true);
    
    // Focus success message for screen readers
    setTimeout(() => {
      successRef.current?.focus();
    }, 100);
    
    setTimeout(() => {
      setSent(false);
      setSendOpen(false);
      setRecipient("");
      setAmount("");
    }, 2000);
  };

  const handleCancel = () => {
    setSendOpen(false);
    setRecipient("");
    setAmount("");
    setFormError(null);
  };

  const networkUpper = network === "testnet" ? "TESTNET" : "PUBLIC";

  const handleViewOnExplorer = () => {
    if (!publicKey) return;
    const url = networkUpper === "TESTNET" 
      ? `https://stellar.expert/explorer/testnet/account/${publicKey}`
      : `https://stellar.expert/explorer/public/account/${publicKey}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Focus recipient input when form opens
  useEffect(() => {
    if (sendOpen && recipientInputRef.current) {
      recipientInputRef.current.focus();
    }
  }, [sendOpen]);

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
        <div 
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 bg-error/10 border border-error/30 rounded-xl px-4 py-3 mb-4"
        >
          <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-error text-[12px] leading-relaxed flex-1">{error}</p>
        </div>
      )}

      {/* USD sub-value */}
      {balance && (
        <p className="text-muted text-[13px] mb-5">≈ {formatUSD(balance.usd, { currencyFormat: 'symbol' })}</p>
      )}

      {/* Send button */}
      {status === "ready" && !sendOpen && (
        <button
          onClick={() => setSendOpen(true)}
          aria-label="Open send XLM form"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand font-bold text-[13px] transition-all"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          Send XLM
        </button>
      )}

      {/* Send form – Venmo-style */}
      {sendOpen && (
        <form 
          ref={formRef}
          onSubmit={handleSend} 
          className="space-y-3 mt-2"
          aria-labelledby="send-form-title"
        >
          <h3 id="send-form-title" className="sr-only">Send XLM Form</h3>
          
          {formError && (
            <div 
              role="alert"
              aria-live="assertive"
              id={errorId}
              className="flex items-start gap-2 bg-error/10 border border-error/30 rounded-xl px-4 py-3"
            >
              <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-error text-[12px] leading-relaxed flex-1">{formError}</p>
            </div>
          )}
          
          {sent && (
            <div 
              ref={successRef}
              role="status"
              aria-live="polite"
              id={successId}
              className="flex items-center gap-2 bg-brand/10 border border-brand/30 rounded-xl px-4 py-3"
              tabIndex={-1}
            >
              <CheckCircle className="w-4 h-4 text-brand" aria-hidden="true" />
              <p className="text-brand text-[12px] font-medium">XLM sent successfully!</p>
            </div>
          )}
          
          <div>
            <label 
              htmlFor={recipientId}
              className="block text-[11px] text-muted font-medium mb-1"
            >
              To (username or address)
            </label>
            <input
              ref={recipientInputRef}
              id={recipientId}
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. @alice or G…"
              required
              aria-describedby={formError ? errorId : undefined}
              className="w-full bg-surface-hover border border-border rounded-xl px-4 py-2.5 text-[13px] text-white placeholder:text-muted focus:outline-none focus:border-brand/50 transition-colors"
            />
          </div>
          <div>
            <label 
              htmlFor={amountId}
              className="block text-[11px] text-muted font-medium mb-1"
            >
              Amount (XLM)
            </label>
            <input
              ref={amountInputRef}
              id={amountId}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0.0000001"
              step="any"
              required
              aria-describedby={formError ? errorId : undefined}
              className="w-full bg-surface-hover border border-border rounded-xl px-4 py-2.5 text-[13px] text-white placeholder:text-muted focus:outline-none focus:border-brand/50 transition-colors"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={sending || sent}
              aria-describedby={sent ? successId : undefined}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-black font-bold text-[13px] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sent ? (
                <><CheckCircle className="w-4 h-4" aria-hidden="true" /> Sent!</>
              ) : sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Sending…</>
              ) : (
                <><Send className="w-4 h-4" aria-hidden="true" /> Send</>
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2.5 rounded-xl border border-border text-muted hover:text-white text-[13px] font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleViewOnExplorer}
            aria-label="View wallet on Stellar Explorer (opens in new tab)"
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-surface-hover hover:bg-border border border-border text-white font-medium text-[12px] transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            Explorer
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[13px] font-bold text-white uppercase tracking-wider">Recent Activity</h4>
          <Link
            href="/activity"
            className="flex items-center gap-1 text-[11px] font-bold text-brand hover:underline"
          >
            View All
            <Activity className="w-3 h-3" />
          </Link>
        </div>
        <ActivityFeed publicKey={publicKey!} network={networkUpper || "TESTNET"} pageSize={5} />
      </div>
    </div>
  );
}
