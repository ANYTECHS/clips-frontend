"use client";

/**
 * TransactionHistoryViewer
 *
 * Displays paginated, filterable on-chain transaction history for MetaMask
 * (Ethereum) and Phantom (Solana) wallets.
 *
 * Spec requirements implemented:
 * - Req 1:  wallet detection via useWallet()
 * - Req 2/3: Ethereum / Solana fetching via useTransactionHistory
 * - Req 4:  display — timestamp, amount, direction, status, fees, confirmations
 * - Req 5:  filter tabs (All / Sent / Received) with sessionStorage persistence
 * - Req 6:  pagination (20 per page, Prev/Next, page count)
 * - Req 7:  auto-refresh every 30 s; new-tx banner; manual refresh button
 * - Req 8:  blockchain explorer links (Etherscan / Solscan)
 * - Req 9:  empty state per filter
 * - Req 10: full-page skeleton on initial load; inline spinner for pagination/refresh
 * - Req 11: error state with retry; non-intrusive auto-refresh error notification
 * - Req 12: sanitize all user-derived strings; no private keys; no address logging
 * - Req 14: ARIA labels, keyboard nav, focus indicators, live regions
 * - Req 15: responsive — vertical stack on mobile, horizontal on desktop
 */

import React, { memo, useCallback, useEffect, useRef } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ExternalLink,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  History,
  Wallet,
  Bell,
} from "lucide-react";

import { useWallet } from "@/components/wallet/WalletProvider";
import { useTransactionHistory, PAGE_SIZE } from "@/app/hooks/useTransactionHistory";
import { formatTxTimestamp, type Transaction, type TxFilter, type TxStatus, type TxDirection } from "@/app/lib/txHistory";
import { sanitize } from "@/app/lib/sanitize";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: TxStatus): string {
  if (status === "confirmed") return "text-brand";
  if (status === "pending")   return "text-warning";
  return "text-error";
}

function statusLabel(status: TxStatus): string {
  if (status === "confirmed") return "Confirmed";
  if (status === "pending")   return "Pending";
  return "Failed";
}

function directionIcon(direction: TxDirection, status: TxStatus) {
  const base = "w-4 h-4 shrink-0";
  if (direction === "incoming") return <ArrowDownLeft className={`${base} text-brand`} aria-hidden />;
  if (direction === "outgoing") return <ArrowUpRight   className={`${base} ${status === "failed" ? "text-error" : "text-muted"}`} aria-hidden />;
  return <ArrowLeftRight className={`${base} text-muted`} aria-hidden />;
}

function directionLabel(direction: TxDirection): string {
  if (direction === "incoming") return "Received";
  if (direction === "outgoing") return "Sent";
  return "Self-transfer";
}

// ─── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div
      className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-border animate-pulse"
      aria-hidden
    >
      <div className="w-8 h-8 rounded-full bg-surface-hover shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="h-3.5 w-32 rounded bg-surface-hover" />
        <div className="h-3 w-48 rounded bg-surface-hover" />
      </div>
      <div className="hidden sm:block space-y-2 text-right">
        <div className="h-3.5 w-20 rounded bg-surface-hover ml-auto" />
        <div className="h-3 w-14 rounded bg-surface-hover ml-auto" />
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading transactions">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

// ─── Individual transaction row ────────────────────────────────────────────────

interface TxRowProps {
  tx: Transaction;
}

const TxRow = memo(function TxRow({ tx }: TxRowProps) {
  const safeFrom = sanitize(tx.fromAddress);
  const safeTo   = sanitize(tx.toAddress);
  const safeAmt  = sanitize(tx.amount);
  const safeSym  = sanitize(tx.assetSymbol);
  const safeFee  = tx.fee ? sanitize(tx.fee) : null;

  const isIncoming = tx.direction === "incoming";
  const amountSign = isIncoming ? "+" : tx.direction === "outgoing" ? "−" : "";
  const amountColor = isIncoming ? "text-brand" : tx.direction === "outgoing" && tx.status !== "failed" ? "text-white" : "text-error";

  const dirLabel = directionLabel(tx.direction);
  const statLabel = statusLabel(tx.status);

  return (
    <div
      className="flex items-start gap-3 p-3 sm:p-4 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors focus-within:ring-2 focus-within:ring-brand/40"
      role="row"
    >
      {/* Direction icon */}
      <div className="mt-0.5" aria-label={dirLabel}>
        {directionIcon(tx.direction, tx.status)}
      </div>

      {/* Left column — addresses & timestamp */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white text-[13px] font-semibold">{dirLabel}</span>
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${
            tx.status === "confirmed" ? "border-brand/30 text-brand bg-brand/5"
            : tx.status === "pending"  ? "border-warning/30 text-warning bg-warning/5"
            : "border-error/30 text-error bg-error/5"
          }`}
            aria-label={`Status: ${statLabel}`}
          >
            {statLabel}
          </span>
          {typeof tx.blockConfirmations === "number" && tx.status !== "confirmed" && (
            <span className="text-[11px] text-muted-foreground">
              {tx.blockConfirmations} confirm{tx.blockConfirmations !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <p className="text-muted text-[11px] sm:text-[12px] font-mono truncate">
          {isIncoming
            ? <><span className="text-muted-foreground">From</span> {safeFrom}</>
            : <><span className="text-muted-foreground">To</span> {safeTo}</>
          }
        </p>

        <p className="text-muted-foreground text-[11px]">
          <time dateTime={new Date(tx.timestamp).toISOString()}>
            {formatTxTimestamp(tx.timestamp)}
          </time>
        </p>
      </div>

      {/* Right column — amount, fee, explorer */}
      <div className="text-right space-y-1 shrink-0">
        <p className={`text-[14px] font-bold font-mono ${amountColor}`}>
          {amountSign}{safeAmt} {safeSym}
        </p>
        {safeFee && tx.direction === "outgoing" && (
          <p className="text-muted-foreground text-[11px] font-mono">
            Fee: {safeFee} {safeSym}
          </p>
        )}
        <a
          href={sanitize(tx.explorerUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-brand transition-colors"
          aria-label={`View transaction ${tx.id.slice(0, 8)}… on blockchain explorer (opens in new tab)`}
        >
          Explorer <ExternalLink className="w-3 h-3" aria-hidden />
        </a>
      </div>
    </div>
  );
});

// ─── Filter tabs ───────────────────────────────────────────────────────────────

interface FilterTabsProps {
  active: TxFilter;
  onChange: (f: TxFilter) => void;
  counts: Record<TxFilter, number>;
}

const FILTERS: { id: TxFilter; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "sent",     label: "Sent" },
  { id: "received", label: "Received" },
];

function FilterTabs({ active, onChange, counts }: FilterTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter transactions"
      className="flex gap-1 p-1 bg-input rounded-xl border border-border"
    >
      {FILTERS.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          aria-selected={active === id}
          onClick={() => onChange(id)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
            active === id
              ? "bg-brand text-black shadow-sm"
              : "text-muted hover:text-white hover:bg-surface-hover"
          }`}
        >
          {label}
          {counts[id] > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              active === id ? "bg-black/20 text-black" : "bg-surface-hover text-muted"
            }`}>
              {counts[id]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Pagination controls ───────────────────────────────────────────────────────

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  isLoading: boolean;
}

function Pagination({ currentPage, totalPages, onPrev, onNext, isLoading }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4 border-t border-border">
      <button
        onClick={onPrev}
        disabled={currentPage <= 1 || isLoading}
        aria-label="Previous page"
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-muted text-[12px] font-medium hover:text-white hover:border-brand/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden />
        Previous
      </button>

      <span className="text-muted text-[12px]" aria-live="polite" aria-atomic>
        Page {currentPage} of {totalPages}
      </span>

      <button
        onClick={onNext}
        disabled={currentPage >= totalPages || isLoading}
        aria-label="Next page"
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-muted text-[12px] font-medium hover:text-white hover:border-brand/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        Next
        <ChevronRight className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}

import { useVirtualizer } from "@tanstack/react-virtual";

function VirtualTransactionList({ transactions, isLoading }: { transactions: Transaction[], isLoading: boolean }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className={`h-[400px] overflow-auto ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
        role="table"
        aria-label="Transaction history"
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const tx = transactions[virtualRow.index];
          return (
            <div
              key={tx.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: "8px",
              }}
            >
              <TxRow tx={tx} />
            </div>
          );
        })}
      </div>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 className="w-6 h-6 text-brand animate-spin" />
        </div>
      )}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: TxFilter }) {
  const message =
    filter === "sent"     ? "No sent transactions found."
    : filter === "received" ? "No received transactions found."
    : "No transactions found for this wallet.";

  const suggestion =
    filter !== "all"
      ? "Try switching to the "All" tab, or verify your wallet is connected correctly."
      : "Once you make transactions, they'll appear here.";

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <History className="w-10 h-10 text-muted mx-auto mb-4" aria-hidden />
      <p className="text-white font-bold text-[16px] mb-2">{message}</p>
      <p className="text-muted text-[13px] max-w-xs">{suggestion}</p>
    </div>
  );
}

// ─── No wallet state ───────────────────────────────────────────────────────────

function NoWalletState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Wallet className="w-10 h-10 text-muted mx-auto mb-4" aria-hidden />
      <p className="text-white font-bold text-[16px] mb-2">No supported wallet connected</p>
      <p className="text-muted text-[13px] max-w-xs">
        Connect MetaMask or Phantom from the wallet menu to view transaction history.
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
  const { address, walletType, isConnected } = useWallet();

  // Only MetaMask and Phantom are supported (per requirements)
  const supportedWalletType =
    walletType === "metamask" ? "metamask"
    : walletType === "phantom" ? "phantom"
    : null;

  const { chainId } = useWallet();

  const {
    transactions,
    filter,
    setFilter,
    currentPage,
    totalPages,
    goToPage,
    isInitialLoading,
    isRefreshing,
    isAutoRefreshing,
    isSlowRequest,
    error,
    newTxCount,
    jumpToNewTransactions,
    refresh,
  } = useTransactionHistory({
    walletType: supportedWalletType,
    address: isConnected ? address : null,
    chainId,
  });

  // Remove scroll to top since we are doing infinite scrolling
  const listRef = useRef<HTMLDivElement>(null);

  const handlePrev = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);
  const handleNext = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);

  // Count filter options
  // These are derived from ALL transactions across all loaded pages for the badge
  const allTxs = transactions; // already filtered for display, counts shown on tabs are approximate
  const counts: Record<TxFilter, number> = {
    all:      transactions.length,
    sent:     transactions.filter((t) => t.direction === "outgoing").length,
    received: transactions.filter((t) => t.direction === "incoming").length,
  };

  const isLoading = isRefreshing || (isInitialLoading && transactions.length === 0);

  return (
    <section
      className={`bg-surface border border-border rounded-[24px] p-5 sm:p-6 space-y-5 ${className}`}
      aria-label="Transaction history"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-extrabold text-white uppercase tracking-wider">
            Transaction History
          </h2>
          {isAutoRefreshing && (
            <Loader2
              className="w-3.5 h-3.5 text-muted animate-spin"
              aria-label="Auto-refreshing"
            />
          )}
        </div>

        <button
          onClick={refresh}
          disabled={isInitialLoading || isRefreshing}
          aria-label="Refresh transaction history"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-muted hover:text-white hover:border-brand/30 text-[12px] font-medium transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </button>
      </div>

      {/* ── New transactions banner ─────────────────────────────────────────── */}
      {newTxCount > 0 && currentPage > 1 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 px-4 py-3 bg-brand/10 border border-brand/30 rounded-xl"
        >
          <div className="flex items-center gap-2 text-brand text-[13px] font-medium">
            <Bell className="w-4 h-4" aria-hidden />
            {newTxCount} new transaction{newTxCount !== 1 ? "s" : ""} available
          </div>
          <button
            onClick={jumpToNewTransactions}
            className="text-brand text-[12px] font-semibold hover:underline cursor-pointer"
          >
            View
          </button>
        </div>
      )}

      {/* ── Slow-request notice ─────────────────────────────────────────────── */}
      {isSlowRequest && (
        <p role="status" aria-live="polite" className="text-muted text-[12px]">
          This is taking longer than expected. Please wait…
        </p>
      )}

      {/* ── Error banner ────────────────────────────────────────────────────── */}
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
                  : error.code === "NETWORK_ERROR"
                  ? "Network error — check your connection."
                  : error.code === "INVALID_ADDRESS"
                  ? "Wallet connection issue — reconnect your wallet."
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

      {/* ── No wallet ───────────────────────────────────────────────────────── */}
      {!isConnected || !supportedWalletType ? (
        <NoWalletState />
      ) : (
        <>
          {/* ── Filter tabs (hidden when loading initial data) ─────────────── */}
          {!isInitialLoading && (
            <FilterTabs active={filter} onChange={setFilter} counts={counts} />
          )}

          {/* ── Transaction list ────────────────────────────────────────────── */}
          <div ref={listRef} className="max-h-[600px] overflow-auto">
            {isInitialLoading ? (
              <SkeletonList />
            ) : transactions.length === 0 ? (
              <EmptyState filter={filter} />
            ) : (
              <VirtualTransactionList transactions={transactions} isLoading={isLoading} />
            )}
          </div>

          {/* ── Infinite Scroll Trigger ───────────────────────────────────────── */}
          {!isInitialLoading && transactions.length > 0 && currentPage < totalPages && (
            <div className="py-4 flex justify-center">
              <button
                onClick={handleNext}
                disabled={isLoading}
                className="px-4 py-2 bg-surface-hover rounded-xl text-[12px] font-medium text-white hover:bg-brand/20 transition-colors"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
