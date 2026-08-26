"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { sanitize } from "@/app/lib/sanitize";
import { formatAmount } from "@/app/lib/formatAmount";
import { useFilterQueryState } from "@/hooks/useFilterQueryState";

const DEFAULT_PAGE_SIZE = 20;
const MAX_HORIZON_PAGE_SIZE = 200;

type HorizonNetwork = "PUBLIC" | "TESTNET";

interface HorizonTransactionRecord {
  id: string;
  hash: string;
  paging_token: string;
  created_at: string;
  successful: boolean;
  source_account: string;
  operation_count: number;
  fee_charged: string;
}

interface HorizonTransactionResponse {
  _embedded?: {
    records?: HorizonTransactionRecord[];
  };
}

type ActivityFilterState = {
  txType: "all" | "successful" | "failed";
  dateRange: "all" | "7d" | "30d" | "90d";
};

const DEFAULT_FILTERS: ActivityFilterState = {
  txType: "all",
  dateRange: "all",
};

const DATE_RANGE_MS: Record<Exclude<ActivityFilterState["dateRange"], "all">, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

function clampPageSize(pageSize?: number): number {
  if (!pageSize || Number.isNaN(pageSize)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.max(Math.floor(pageSize), 1), MAX_HORIZON_PAGE_SIZE);
}

function getHorizonBaseUrl(network: HorizonNetwork): string {
  return network === "PUBLIC"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";
}

function toReadableDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return sanitize(isoDate);
  }

  return sanitize(
    date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}

function toFeeXLM(stroops: string): string {
  const stroopsAsNumber = Number(stroops);
  if (!Number.isFinite(stroopsAsNumber)) {
    return "0.0000000";
  }

  return formatAmount(stroopsAsNumber / 10_000_000, {
    decimals: 7,
    locale: "en-US",
    minimumFractionDigits: 7,
  });
}

function isInDateRange(createdAt: string, dateRange: ActivityFilterState["dateRange"]): boolean {
  if (dateRange === "all") {
    return true;
  }

  const transactionTime = new Date(createdAt).getTime();
  if (Number.isNaN(transactionTime)) {
    return false;
  }

  const threshold = Date.now() - DATE_RANGE_MS[dateRange];
  return transactionTime >= threshold;
}

export interface ActivityFeedProps {
  publicKey: string;
  network: HorizonNetwork;
  pageSize?: number;
  onTotalCountChange?: (count: number) => void;
}

export default function ActivityFeed({
  publicKey,
  network,
  pageSize = DEFAULT_PAGE_SIZE,
  onTotalCountChange,
}: ActivityFeedProps) {
  const { filters, updateFilters } = useFilterQueryState<ActivityFilterState>(DEFAULT_FILTERS);
  const effectivePageSize = useMemo(() => clampPageSize(pageSize), [pageSize]);
  const horizonBaseUrl = useMemo(() => getHorizonBaseUrl(network), [network]);

  const [transactions, setTransactions] = useState<HorizonTransactionRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams({
        order: "desc",
        limit: String(effectivePageSize),
      });

      if (cursor) {
        params.set("cursor", cursor);
      }

      const response = await fetch(
        `${horizonBaseUrl}/accounts/${encodeURIComponent(publicKey)}/transactions?${params.toString()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch transactions (${response.status})`);
      }

      const payload = (await response.json()) as HorizonTransactionResponse;
      const records = payload._embedded?.records ?? [];

      return {
        records,
        nextCursor: records.length > 0 ? records[records.length - 1].paging_token : null,
      };
    },
    [effectivePageSize, horizonBaseUrl, publicKey]
  );

  const loadInitial = useCallback(async () => {
    setError(null);
    setIsLoadingInitial(true);

    try {
      const { records, nextCursor: returnedCursor } = await fetchTransactions();
      setTransactions(records);
      setNextCursor(returnedCursor);
      setHasMore(records.length === effectivePageSize);
    } catch (err) {
      setTransactions([]);
      setNextCursor(null);
      setHasMore(false);
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setIsLoadingInitial(false);
    }
  }, [effectivePageSize, fetchTransactions]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingMore) {
      return;
    }

    setError(null);
    setIsLoadingMore(true);

    try {
      const { records, nextCursor: returnedCursor } = await fetchTransactions(nextCursor);

      setTransactions((prev) => {
        const merged = [...prev, ...records];
        const seen = new Set<string>();
        return merged.filter((record) => {
          if (seen.has(record.id)) {
            return false;
          }
          seen.add(record.id);
          return true;
        });
      });

      setNextCursor(returnedCursor);
      setHasMore(records.length === effectivePageSize);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more transactions");
    } finally {
      setIsLoadingMore(false);
    }
  }, [effectivePageSize, fetchTransactions, hasMore, isLoadingMore, nextCursor]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (filters.txType === "successful" && !transaction.successful) {
        return false;
      }

      if (filters.txType === "failed" && transaction.successful) {
        return false;
      }

      if (!isInDateRange(transaction.created_at, filters.dateRange)) {
        return false;
      }

      return true;
    });
  }, [filters.dateRange, filters.txType, transactions]);

  useEffect(() => {
    onTotalCountChange?.(filteredTransactions.length);
  }, [filteredTransactions.length, onTotalCountChange]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted">Total transactions</p>
          <p className="text-xl font-bold text-white">{filteredTransactions.length}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-xs text-muted" htmlFor="activity-filter-type">
            Type
          </label>
          <select
            id="activity-filter-type"
            className="rounded-lg border border-border bg-surface-hover px-3 py-2 text-sm text-white"
            value={filters.txType}
            onChange={(event) => {
              updateFilters({ txType: event.target.value as ActivityFilterState["txType"] });
            }}
          >
            <option value="all">All</option>
            <option value="successful">Successful</option>
            <option value="failed">Failed</option>
          </select>

          <label className="text-xs text-muted" htmlFor="activity-filter-range">
            Date
          </label>
          <select
            id="activity-filter-range"
            className="rounded-lg border border-border bg-surface-hover px-3 py-2 text-sm text-white"
            value={filters.dateRange}
            onChange={(event) => {
              updateFilters({ dateRange: event.target.value as ActivityFilterState["dateRange"] });
            }}
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {sanitize(error)}
        </div>
      )}

      {isLoadingInitial ? (
        <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-6 text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading transactions...
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="rounded-lg border border-border px-4 py-6 text-sm text-muted">
          No transactions found for the selected filters.
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredTransactions.map((transaction) => (
            <li
              key={transaction.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-hover/40 px-4 py-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-semibold text-white">
                  {sanitize(transaction.hash)}
                </p>
                <p className="text-xs text-muted">{toReadableDate(transaction.created_at)}</p>
              </div>

              <div className="shrink-0 text-right">
                <p
                  className={`text-xs font-semibold ${
                    transaction.successful ? "text-success" : "text-error"
                  }`}
                >
                  {transaction.successful ? "Successful" : "Failed"}
                </p>
                <p className="text-xs text-muted">Fee: {toFeeXLM(transaction.fee_charged)} XLM</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted">
          Page size: {effectivePageSize} (max {MAX_HORIZON_PAGE_SIZE})
        </p>

        {hasMore && !isLoadingInitial && (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-hover px-3 py-2 text-sm text-white hover:bg-surface-hover/80 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void loadMore();
            }}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Load More
          </button>
        )}
      </div>
    </section>
  );
}