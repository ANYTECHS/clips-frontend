"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, RefreshCw, ExternalLink, FlaskConical, Copy, Check } from "lucide-react";
import {
  getStellarLabUrl,
  getStellarExpertAccountUrl,
  getStellarExpertTransactionUrl,
  getStellarScanAccountUrl,
  getStellarScanTransactionUrl,
} from "@/app/lib/networkConfig";
import { useToast } from "@/hooks/useToast";

export interface Transaction {
  id: string;
  type: "received" | "sent";
  amount: string;
  asset: string;
  counterparty: string;
  timestamp: Date;
  memo?: string;
  txHash: string;
}

interface TransactionHistoryProps {
  publicKey: string;
  network?: "PUBLIC" | "TESTNET";
  limit?: number;
}

async function fetchTransactions(
  publicKey: string,
  network: "PUBLIC" | "TESTNET",
  limit: number
): Promise<Transaction[]> {
  const horizonUrl =
    network === "PUBLIC"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";

  const res = await fetch(
    `${horizonUrl}/accounts/${publicKey}/payments?order=desc&limit=${limit}`
  );

  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error("Failed to fetch transactions");
  }

  const data = await res.json();
  const records = data._embedded?.records ?? [];

  return records
    .filter((r: any) => r.type === "payment" || r.type === "create_account")
    .map((r: any): Transaction => {
      const isSent = r.from === publicKey;
      return {
        id: r.id,
        type: isSent ? "sent" : "received",
        amount: r.amount ?? r.starting_balance ?? "0",
        asset: r.asset_type === "native" ? "XLM" : r.asset_code ?? "?",
        counterparty: isSent ? (r.to ?? r.account ?? "") : (r.from ?? r.funder ?? ""),
        timestamp: new Date(r.created_at),
        memo: r.transaction?.memo,
        txHash: r.transaction_hash,
      };
    });
}

function truncate(key: string) {
  if (!key || key.length < 12) return key;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

function formatDate(d: Date) {
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString();
}

export default function TransactionHistory({
  publicKey,
  network = "TESTNET",
  limit = 10,
}: TransactionHistoryProps) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const stellarNetwork = network === "PUBLIC" ? "mainnet" : "testnet";
  const accountExpertUrl = getStellarExpertAccountUrl(publicKey, stellarNetwork);
  const accountScanUrl = getStellarScanAccountUrl(publicKey, stellarNetwork);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTransactions(publicKey, network, limit);
      setTxs(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [publicKey, network, limit]);

  const handleCopy = useCallback((text: string, type: "address" | "hash") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedHash(text);
      showToast(`${type === "address" ? "Address" : "Transaction hash"} copied to clipboard`, "success");
      setTimeout(() => setCopiedHash(null), 1500);
    });
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-[13px] font-bold text-white uppercase tracking-wider">
            Recent Activity
          </h4>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={accountExpertUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-brand hover:text-white transition-colors"
              title="View account on Stellar Expert"
            >
              View account on Stellar Expert
            </a>
            <a
              href={accountScanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-muted hover:text-white transition-colors"
              title="View account on StellarScan"
            >
              View account on StellarScan
            </a>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          aria-label={loading ? "Refreshing transaction history" : "Refresh transaction history"}
          aria-busy={loading}
          className="p-1 rounded hover:bg-surface-hover transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {loading && txs.length === 0 && (
        <div 
          className="flex justify-center py-6"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="w-5 h-5 text-brand animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading transactions</span>
        </div>
      )}

      {error && (
        <p 
          className="text-error text-[12px] py-2"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      )}

      {!loading && !error && txs.length === 0 && (
        <p 
          className="text-muted text-[12px] py-4 text-center"
          role="status"
          aria-live="polite"
        >
          No transactions yet
        </p>
      )}

      {txs.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center gap-3 p-3 rounded-xl bg-surface-hover border border-border hover:border-brand/20 transition-colors"
          role="listitem"
        >
          {/* Direction icon */}
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              tx.type === "received"
                ? "bg-brand/10 text-brand"
                : "bg-error/10 text-error"
            }`}
            aria-hidden="true"
          >
            {tx.type === "received" ? (
              <ArrowDownLeft className="w-4 h-4" />
            ) : (
              <ArrowUpRight className="w-4 h-4" />
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-bold text-white capitalize">{tx.type}</span>
              <span
                className={`text-[13px] font-bold shrink-0 ${
                  tx.type === "received" ? "text-brand" : "text-error"
                }`}
              >
                {tx.type === "received" ? "+" : "-"}
                {parseFloat(tx.amount).toFixed(2)} {tx.asset}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <button 
                onClick={() => handleCopy(tx.counterparty, "address")}
                className="text-[11px] text-muted hover:text-white transition-colors font-mono flex items-center gap-1 group"
                title="Copy counterparty address"
              >
                <span className="truncate">{truncate(tx.counterparty)}</span>
                <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-muted">{formatDate(tx.timestamp)}</span>
                <div className="flex items-center gap-1 border-l border-border pl-1.5 ml-0.5">
                  <button
                    onClick={() => handleCopy(tx.txHash, "hash")}
                    className="text-muted hover:text-brand transition-colors"
                    title="Copy transaction hash"
                  >
                    {copiedHash === tx.txHash ? (
                      <Check className="w-3 h-3 text-brand" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  <a
                    href={getStellarExpertTransactionUrl(tx.txHash, stellarNetwork)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted hover:text-brand transition-colors"
                    title="View on Stellar Expert"
                    aria-label={`View transaction ${tx.txHash} on Stellar Expert (opens in new tab)`}
                  >
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                  <a
                    href={getStellarScanTransactionUrl(tx.txHash, stellarNetwork)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted hover:text-brand transition-colors"
                    title="View on StellarScan"
                    aria-label={`View transaction ${tx.txHash} on StellarScan (opens in new tab)`}
                  >
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                  <a
                    href={getStellarLabUrl(tx.txHash, stellarNetwork)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted hover:text-brand transition-colors"
                    title="Open in Stellar Lab"
                    aria-label={`Open transaction ${tx.txHash} in Stellar Laboratory (opens in new tab)`}
                  >
                    <FlaskConical className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
