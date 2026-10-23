"use client";

/**
 * TransactionHistoryViewer
 *
 * Displays the connected Stellar wallet's transaction history with
 * cursor-based infinite scroll and filters.
 *
 * - Data: useStellarTransactionHistory → GET /api/wallet/transactions
 *   (cursor + limit), with recent pages cached in app/lib/txHistory.ts
 * - Infinite scroll: a sentinel watched by useIntersectionObserver loads the
 *   next page as it nears the viewport (a "Load more" button is kept as a
 *   keyboard / no-IntersectionObserver fallback)
 * - Filters: transaction type (payment, mint, trustline), date range, asset
 * - Rows: date, type, amount, asset, counterparty, status, Stellar Explorer link
 *   (testnet vs public explorer follows the active network)
 * - Loading: SkeletonTable while the first page is fetched
 * - All user/chain-derived strings are sanitized before rendering
 */

import { AlertCircle, ExternalLink, History, Loader2, RefreshCw, Wallet } from "lucide-react";
import React, { memo, useEffect, useState } from "react";

import { useOptionalNetworkContext } from "@/app/context/NetworkContext";
import { useDebounce } from "@/app/hooks/useDebounce";
import { useIntersectionObserver } from "@/app/hooks/useIntersectionObserver";
import { useRenderTiming } from "@/app/hooks/useRenderTiming";
import { useStellarTransactionHistory } from "@/app/hooks/useTransactionHistory";
import { getStellarNetwork } from "@/app/lib/networkConfig";
import { sanitize } from "@/app/lib/sanitize";
import { truncateStellarAddress } from "@/app/lib/stringUtils";
import {
  formatTxTimestamp,
  getStellarTxExplorerUrl,
  type StellarNetworkName,
  type StellarTransaction,
  type StellarTxType,
} from "@/app/lib/txHistory";
import SkeletonTable from "@/components/ui/SkeletonTable";
import { useWallet } from "@/components/wallet/WalletProvider";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<StellarTxType, string> = {
  payment: "Payment",
  mint: "Mint",
  trustline: "Trustline",
  other: "Other",
};

const TYPE_OPTIONS: { value: StellarTxType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "payment", label: "Payment" },
  { value: "mint", label: "Mint" },
  { value: "trustline", label: "Trustline" },
];

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

const inputClass =
  "bg-input border border-border rounded-xl px-3 py-1.5 text-[12px] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

// ─── Row ───────────────────────────────────────────────────────────────────────

const TxRow = memo(function TxRow({
  tx,
  network,
}: {
  tx: StellarTransaction;
  network: StellarNetworkName;
}) {
  const counterparty = tx.counterparty ? sanitize(tx.counterparty) : null;
  const hash = sanitize(tx.hash);

  return (
    <tr className="border-b border-border hover:bg-surface-hover transition-colors" data-testid="tx-row">
      <td className="px-4 py-3 text-muted-foreground text-[12px] whitespace-nowrap">
        <time dateTime={sanitize(tx.createdAt)}>{formatTxTimestamp(Date.parse(tx.createdAt))}</time>
      </td>
      <td className="px-4 py-3 text-white text-[12px] font-semibold">{TYPE_LABELS[tx.type]}</td>
      <td className="px-4 py-3 text-white text-[12px] font-mono text-right">
        {tx.amount !== null ? sanitize(tx.amount) : "—"}
      </td>
      <td className="px-4 py-3 text-white text-[12px]">{sanitize(tx.asset)}</td>
      <td className="px-4 py-3 text-muted text-[12px] font-mono" title={counterparty ?? undefined}>
        {counterparty ? truncateStellarAddress(counterparty) : "—"}
      </td>
      <td className="px-4 py-3">
        <span
          className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${
            tx.status === "success"
              ? "border-brand/30 text-brand bg-brand/5"
              : "border-error/30 text-error bg-error/5"
          }`}
        >
          {tx.status === "success" ? "Success" : "Failed"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <a
          href={getStellarTxExplorerUrl(tx.hash, network)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-brand transition-colors"
          aria-label={`View transaction ${hash.slice(0, 8)}… on Stellar Explorer (opens in new tab)`}
        >
          Explorer <ExternalLink className="w-3 h-3" aria-hidden />
        </a>
      </td>
    </tr>
  );
});

// ─── Empty / no-wallet states ──────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <History className="w-10 h-10 text-muted mx-auto mb-4" aria-hidden />
      <p className="text-white font-bold text-[16px] mb-2">
        {filtered ? "No transactions match these filters." : "No transactions found for this wallet."}
      </p>
      <p className="text-muted text-[13px] max-w-xs">
        {filtered
          ? "Try widening the date range or clearing the type and asset filters."
          : "Once you make payments, mint NFTs or add trustlines, they'll appear here."}
      </p>
    </div>
  );
}

function NoWalletState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Wallet className="w-10 h-10 text-muted mx-auto mb-4" aria-hidden />
      <p className="text-white font-bold text-[16px] mb-2">No Stellar wallet connected</p>
      <p className="text-muted text-[13px] max-w-xs">
        Connect a Stellar wallet from the wallet menu to view transaction history.
      </p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export interface TransactionHistoryViewerProps {
  /** Optional CSS class for the root element */
  className?: string;
}

export default function TransactionHistoryViewer({ className = "" }: TransactionHistoryViewerProps) {
  const { address, isConnected } = useWallet();
  const network = useOptionalNetworkContext()?.network ?? getStellarNetwork();
  const stellarAddress =
    isConnected && address && STELLAR_ADDRESS_RE.test(address) ? address : null;

  const [type, setType] = useState<StellarTxType | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [assetInput, setAssetInput] = useState("");
  const asset = useDebounce(assetInput.trim(), 400);

  const {
    transactions,
    setFilters,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
  } = useStellarTransactionHistory({ address: stellarAddress, network });

  useEffect(() => {
    setFilters({
      type,
      asset: asset || undefined,
      from: from || undefined,
      to: to || undefined,
    });
  }, [type, asset, from, to, setFilters]);

  useRenderTiming("TransactionHistoryViewer", [transactions.length, isLoading]);

  // Infinite scroll sentinel — keeps observing so each page that leaves the
  // sentinel in view triggers the next one.
  const { ref: sentinelRef, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
    rootMargin: "200px",
    once: false,
    enabled: hasMore,
  });

  useEffect(() => {
    if (isIntersecting && hasMore && !isLoadingMore && !isLoading) loadMore();
  }, [isIntersecting, hasMore, isLoadingMore, isLoading, loadMore]);

  const isFiltered = type !== "all" || !!asset || !!from || !!to;

  const clearFilters = () => {
    setType("all");
    setFrom("");
    setTo("");
    setAssetInput("");
  };

  return (
    <section
      className={`bg-surface border border-border rounded-[24px] p-5 sm:p-6 space-y-5 ${className}`}
      aria-label="Transaction history"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[15px] font-extrabold text-white uppercase tracking-wider">
          Transaction History
        </h2>

        <button
          onClick={refresh}
          disabled={isLoading || !stellarAddress}
          aria-label="Refresh transaction history"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-muted hover:text-white hover:border-brand/30 text-[12px] font-medium transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </button>
      </div>

      {!stellarAddress ? (
        <NoWalletState />
      ) : (
        <>
          {/* ── Filters ────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filter transactions">
            <label className="flex flex-col gap-1 text-[11px] text-muted">
              Type
              <select
                value={type}
                onChange={(e) => setType(e.target.value as StellarTxType | "all")}
                className={inputClass}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted">
              From
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted">
              To
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted">
              Asset
              <input
                type="text"
                placeholder="e.g. XLM"
                value={assetInput}
                maxLength={12}
                onChange={(e) => setAssetInput(e.target.value)}
                className={`${inputClass} w-28`}
              />
            </label>
            {isFiltered && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[12px] text-muted hover:text-white underline cursor-pointer pb-1.5"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* ── Error banner ────────────────────────────────────────────────── */}
          {error && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 px-4 py-3 bg-error/10 border border-error/30 rounded-xl"
            >
              <div className="flex items-start gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-error text-[13px] font-medium">
                    {error.code === "RATE_LIMITED"
                      ? "Rate limit exceeded."
                      : "Failed to load transactions."}
                  </p>
                  <p className="text-error/70 text-[12px] mt-0.5">{sanitize(error.message)}</p>
                </div>
              </div>
              <button
                onClick={refresh}
                className="shrink-0 text-error text-[12px] font-semibold hover:underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* ── List ────────────────────────────────────────────────────────── */}
          {isLoading ? (
            <SkeletonTable rows={6} cols={7} showFilterBar={false} />
          ) : transactions.length === 0 ? (
            !error && <EmptyState filtered={isFiltered} />
          ) : (
            <div className="max-h-[600px] overflow-auto rounded-xl border border-border">
              <table className="w-full text-left" aria-label="Transaction history">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
                    <th scope="col" className="px-4 py-2 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Type</th>
                    <th scope="col" className="px-4 py-2 font-semibold text-right">Amount</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Asset</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Counterparty</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-2 font-semibold text-right">
                      <span className="sr-only">Explorer link</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <TxRow key={tx.id} tx={tx} network={network} />
                  ))}
                </tbody>
              </table>

              {/* ── Infinite scroll sentinel ───────────────────────────────── */}
              <div ref={sentinelRef} data-testid="tx-scroll-sentinel" aria-hidden className="h-px" />

              {hasMore && (
                <div className="py-4 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="px-4 py-2 bg-surface-hover rounded-xl text-[12px] font-medium text-white hover:bg-brand/20 transition-colors cursor-pointer"
                  >
                    {isLoadingMore ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-label="Loading more" />
                    ) : (
                      "Load more"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
