"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  ExternalLink,
  FlaskConical,
  Copy,
  Check,
  Filter,
  ChevronDown,
  ListFilter,
} from "lucide-react";
import { getStellarLabUrl } from "@/app/lib/networkConfig";
import { useToast } from "@/hooks/useToast";
import Skeleton from "@/components/ui/Skeleton";

export interface ActivityTransaction {
  id: string;
  type: "received" | "sent";
  amount: string;
  asset: string;
  counterparty: string;
  timestamp: Date;
  memo?: string;
  txHash: string;
}

type FilterType = "all" | "sent" | "received";

interface ActivityFeedProps {
  publicKey: string;
  network?: "PUBLIC" | "TESTNET";
  pageSize?: number;
}

const HORIZON_URLS: Record<string, string> = {
  PUBLIC: "https://horizon.stellar.org",
  TESTNET: "https://horizon-testnet.stellar.org",
};

async function fetchActivityPage(
  publicKey: string,
  network: "PUBLIC" | "TESTNET",
  cursor?: string,
  limit: number = 20,
  order: "asc" | "desc" = "desc"
): Promise<{ transactions: ActivityTransaction[]; cursor: string | null }> {
  const horizonUrl = HORIZON_URLS[network];
  const url = new URL(
    `${horizonUrl}/accounts/${publicKey}/payments`
  );
  url.searchParams.set("order", order);
  url.searchParams.set("limit", String(limit));
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const res = await fetch(url.toString());

  if (!res.ok) {
    if (res.status === 404) return { transactions: [], cursor: null };
    throw new Error("Failed to fetch transactions");
  }

  const data = await res.json();
  const records = data._embedded?.records ?? [];
  const nextLink = data._links?.next?.href ?? null;

  const transactions = records
    .filter((r: any) => r.type === "payment" || r.type === "create_account")
    .map((r: any): ActivityTransaction => {
      const isSent = r.from === publicKey;
      return {
        id: r.id,
        type: isSent ? "sent" : "received",
        amount: r.amount ?? r.starting_balance ?? "0",
        asset: r.asset_type === "native" ? "XLM" : r.asset_code ?? "?",
        counterparty: isSent
          ? r.to ?? r.account ?? ""
          : r.from ?? r.funder ?? "",
        timestamp: new Date(r.created_at),
        memo: r.transaction?.memo,
        txHash: r.transaction_hash,
      };
    });

  // Extract cursor from the next link
  let nextCursor: string | null = null;
  if (nextLink) {
    try {
      const nextUrl = new URL(nextLink);
      nextCursor = nextUrl.searchParams.get("cursor");
    } catch {
      nextCursor = null;
    }
  }

  return { transactions, cursor: nextCursor };
}

function truncateKey(key: string) {
  if (!key || key.length < 12) return key;
  return `${key.slice(0, 6)}\u2026${key.slice(-4)}`;
}

function formatActivityDate(d: Date) {
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ActivityFeed({
  publicKey,
  network = "TESTNET",
  pageSize = 20,
}: ActivityFeedProps) {
  const [allTxs, setAllTxs] = useState<ActivityTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const pagesRef = useRef<ActivityTransaction[][]>([]);
  const { showToast } = useToast();
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const explorerBase =
    network === "PUBLIC"
      ? "https://stellar.expert/explorer/public/tx"
      : "https://stellar.expert/explorer/testnet/tx";

  const loadPage = useCallback(
    async (newCursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchActivityPage(
          publicKey,
          network,
          newCursor,
          pageSize,
          "desc"
        );
        if (result.transactions.length === 0) {
          setHasMore(false);
        } else {
          pagesRef.current = [...pagesRef.current, result.transactions];
          setAllTxs((prev) => [...prev, ...result.transactions]);
          setCursor(result.cursor);
        }
      } catch (e: any) {
        setError(e.message ?? "Failed to load transactions");
      } finally {
        setLoading(false);
      }
    },
    [publicKey, network, pageSize]
  );

  const refresh = useCallback(() => {
    pagesRef.current = [];
    setAllTxs([]);
    setCursor(null);
    setHasMore(true);
    setPage(0);
    setFilter("all");
    setError(null);
    loadPage();
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore && cursor) {
      loadPage(cursor);
    }
  }, [loading, hasMore, cursor, loadPage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCopy = useCallback(
    (text: string, type: "address" | "hash") => {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedHash(text);
        showToast(
          `${type === "address" ? "Address" : "Transaction hash"} copied to clipboard`,
          "success"
        );
        setTimeout(() => setCopiedHash(null), 1500);
      });
    },
    [showToast]
  );

  const filteredTxs = allTxs.filter((tx) => {
    if (filter === "all") return true;
    return tx.type === filter;
  });

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "received", label: "Received" },
    { value: "sent", label: "Sent" },
  ];

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-bold text-white uppercase tracking-wider">
          Activity Feed
        </h4>
        <button
          onClick={refresh}
          disabled={loading}
          aria-label={loading ? "Refreshing activity feed" : "Refresh activity feed"}
          aria-busy={loading}
          className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50 cursor-pointer"
          title="Refresh"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-muted ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2" role="group" aria-label="Filter transactions">
        <ListFilter className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            aria-pressed={filter === opt.value}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              filter === opt.value
                ? "bg-brand/10 text-brand border border-brand/30"
                : "bg-surface-hover text-muted border border-border hover:text-white hover:border-white/20"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && allTxs.length === 0 && (
        <div className="space-y-2" role="status" aria-label="Loading transactions">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-hover/50">
              <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          ))}
          <span className="sr-only">Loading transactions</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          className="flex items-start gap-2 bg-error/10 border border-error/30 rounded-xl px-4 py-3"
          role="alert"
          aria-live="assertive"
        >
          <span className="text-error text-[12px] leading-relaxed flex-1">{error}</span>
          <button
            onClick={refresh}
            className="text-error hover:text-white text-[11px] font-bold underline cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && allTxs.length === 0 && (
        <div
          className="text-center py-10"
          role="status"
          aria-live="polite"
        >
          <div className="w-12 h-12 rounded-full bg-surface-hover border border-border flex items-center justify-center mx-auto mb-3">
            <Filter className="w-5 h-5 text-muted" aria-hidden="true" />
          </div>
          <p className="text-muted text-[13px]">No transactions yet</p>
          <p className="text-muted-foreground text-[11px] mt-1">
            Your activity will appear here once you send or receive payments.
          </p>
        </div>
      )}

      {/* Empty filter state */}
      {!loading && !error && allTxs.length > 0 && filteredTxs.length === 0 && (
        <p className="text-muted text-[12px] py-4 text-center">
          No {filter} transactions found.
        </p>
      )}

      {/* Transaction list */}
      <div className="space-y-2" role="list" aria-label="Transaction history">
        {filteredTxs.map((tx) => (
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
                <span className="text-[13px] font-bold text-white capitalize">
                  {tx.type}
                </span>
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
                  <span className="truncate max-w-[120px] sm:max-w-[200px]">
                    {truncateKey(tx.counterparty)}
                  </span>
                  <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-muted">
                    {formatActivityDate(tx.timestamp)}
                  </span>
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
                      href={`${explorerBase}/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted hover:text-brand transition-colors"
                      title="View on explorer"
                      aria-label="View transaction on Stellar Explorer (opens in new tab)"
                    >
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                    <a
                      href={getStellarLabUrl(
                        tx.txHash,
                        network === "PUBLIC" ? "mainnet" : "testnet"
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted hover:text-brand transition-colors"
                      title="Open in Stellar Lab"
                      aria-label="Open transaction in Stellar Laboratory (opens in new tab)"
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

      {/* Pagination / Load more */}
      {hasMore && allTxs.length > 0 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMore}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-hover border border-border text-muted hover:text-white hover:border-brand/30 text-[12px] font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                Loading\u2026
              </>
            ) : (
              <>
                Load More
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Summary */}
      {!loading && allTxs.length > 0 && (
        <p className="text-[11px] text-muted-foreground text-center pt-1">
          Showing {filteredTxs.length} of {allTxs.length} transactions
        </p>
      )}
    </div>
  );
}


