"use client";

/**
 * useTransactionHistory
 *
 * Manages fetching, pagination, filtering, and auto-refresh of transaction
 * history for MetaMask and Phantom wallets.
 *
 * SSE / real-time is not applicable here — blockchain explorers don't push
 * updates. Auto-refresh polls every 30 s (spec req 7.1) and is paused when
 * the browser tab is hidden (spec req 7.7 / 7.8).
 *
 * The hook keeps a per-page cache so navigating back to a previously viewed
 * page never fires another API request (spec req 6.10).
 *
 * Pagination: each page requests 50 txs from the API and then slices them
 * into PAGE_SIZE (20) display rows, following spec req 6.1.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchTransactionHistory,
  filterTransactions,
  clearTxCache,
  TxHistoryError,
  type Transaction,
  type TxFilter,
  type WalletType,
} from "@/app/lib/txHistory";
import { logger } from "@/app/lib/logger";

// ─── Constants ─────────────────────────────────────────────────────────────────

export const PAGE_SIZE = 20;
const AUTO_REFRESH_INTERVAL_MS = 30_000;
const MIN_LOADING_DISPLAY_MS = 300; // prevent flicker (spec req 10.7)
const SLOW_REQUEST_THRESHOLD_MS = 5_000;
const CONSECUTIVE_ERROR_WARN_THRESHOLD = 3;
const AUTO_REFRESH_ERROR_RETRY_DELAY_MS = 60_000;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UseTransactionHistoryOptions {
  walletType: WalletType | null;
  address: string | null;
  chainId?: string | null;
  /** Override auto-refresh interval — useful in tests */
  refreshIntervalMs?: number;
}

export interface UseTransactionHistoryResult {
  /** Transactions for the current page after filtering */
  transactions: Transaction[];
  /** Active filter */
  filter: TxFilter;
  setFilter: (f: TxFilter) => void;
  /** 1-based page number */
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  /** True on initial load (shows full-page skeleton) */
  isInitialLoading: boolean;
  /** True during pagination or manual refresh (shows inline spinner) */
  isRefreshing: boolean;
  /** True during auto-refresh background tick */
  isAutoRefreshing: boolean;
  /** True if the request is taking longer than SLOW_REQUEST_THRESHOLD_MS */
  isSlowRequest: boolean;
  error: TxHistoryError | null;
  /** New transactions detected since last first-page render */
  newTxCount: number;
  /** Dismiss the "new transactions" banner and go to page 1 */
  jumpToNewTransactions: () => void;
  /** Manually trigger a full refresh (resets to page 1) */
  refresh: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useTransactionHistory({
  walletType,
  address,
  chainId = null,
  refreshIntervalMs = AUTO_REFRESH_INTERVAL_MS,
}: UseTransactionHistoryOptions): UseTransactionHistoryResult {
  // Raw fetched pages (50 txs each from API)
  const [pageCache, setPageCache] = useState<Map<number, Transaction[]>>(new Map());

  const [filter, setFilterState] = useState<TxFilter>(() => {
    if (typeof sessionStorage !== "undefined") {
      const saved = sessionStorage.getItem("txHistoryFilter");
      if (saved === "sent" || saved === "received") return saved;
    }
    return "all";
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [isSlowRequest, setIsSlowRequest] = useState(false);
  const [error, setError] = useState<TxHistoryError | null>(null);
  const [newTxCount, setNewTxCount] = useState(0);
  const [firstKnownTxId, setFirstKnownTxId] = useState<string | null>(null);

  const consecutiveErrorsRef = useRef(0);
  const autoRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const addressRef = useRef(address);
  const chainIdRef = useRef(chainId);
  const walletTypeRef = useRef(walletType);

  // Keep refs in sync for use inside timer callbacks
  useEffect(() => { addressRef.current = address; }, [address]);
  useEffect(() => { chainIdRef.current = chainId; }, [chainId]);
  useEffect(() => { walletTypeRef.current = walletType; }, [walletType]);

  // ── Persist filter to sessionStorage ────────────────────────────────────────

  const setFilter = useCallback((f: TxFilter) => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("txHistoryFilter", f);
    }
    setFilterState(f);
  }, []);

  // ── Derived display data ─────────────────────────────────────────────────────

  /** All fetched txs as a flat list (from the API-page cache) */
  const allTxs: Transaction[] = [];
  for (let p = 1; p <= pageCache.size; p++) {
    const page = pageCache.get(p);
    if (page) allTxs.push(...page);
  }

  const filteredTxs = filterTransactions(allTxs, filter);
  const displayTxs = filteredTxs;
  let hasMore = true;
  for (let p = 1; p <= pageCache.size; p++) {
    const page = pageCache.get(p);
    if (page && page.length < 50) {
      hasMore = false;
      break;
    }
  }
  const totalPages = hasMore ? currentPage + 1 : currentPage;
  const safePage = currentPage;

  // ── Core fetch logic ─────────────────────────────────────────────────────────

  const fetchPage = useCallback(
    async (
      apiPage: number,
      opts: { isInitial?: boolean; isManualRefresh?: boolean; isAuto?: boolean } = {},
    ) => {
      const wt = walletTypeRef.current;
      const addr = addressRef.current;
      const cid = chainIdRef.current;

      if (!wt || !addr) return;

      const loadingStart = Date.now();

      if (opts.isInitial) setIsInitialLoading(true);
      if (opts.isManualRefresh) setIsRefreshing(true);
      if (opts.isAuto) setIsAutoRefreshing(true);

      // Slow-request warning
      slowTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setIsSlowRequest(true);
      }, SLOW_REQUEST_THRESHOLD_MS);

      setError(null);

      try {
        const txs = await fetchTransactionHistory(wt, addr, cid, apiPage);

        // Enforce min display time to avoid flicker
        const elapsed = Date.now() - loadingStart;
        if (elapsed < MIN_LOADING_DISPLAY_MS) {
          await new Promise((r) => setTimeout(r, MIN_LOADING_DISPLAY_MS - elapsed));
        }

        if (!isMountedRef.current) return;

        setPageCache((prev) => {
          const next = new Map(prev);
          next.set(apiPage, txs);
          return next;
        });

        // Track "new tx" count for auto-refresh banner
        if (opts.isAuto && firstKnownTxId && txs.length > 0) {
          const idx = txs.findIndex((tx) => tx.id === firstKnownTxId);
          const count = idx === -1 ? txs.length : idx;
          if (count > 0) setNewTxCount(count);
        }

        // Record the oldest-known first tx id on initial load
        if ((opts.isInitial || opts.isManualRefresh) && txs.length > 0) {
          setFirstKnownTxId(txs[0].id);
          setNewTxCount(0);
        }

        consecutiveErrorsRef.current = 0;
      } catch (err) {
        if (!isMountedRef.current) return;

        const txErr =
          err instanceof TxHistoryError
            ? err
            : new TxHistoryError(
                err instanceof Error ? err.message : "Unknown error",
                "UNKNOWN",
              );

        consecutiveErrorsRef.current += 1;

        if (opts.isAuto) {
          // Auto-refresh errors are non-intrusive — don't replace existing list
          logger.warn(`[useTransactionHistory] auto-refresh error #${consecutiveErrorsRef.current}:`, txErr.message);
        } else {
          setError(txErr);
          logger.error("[useTransactionHistory] fetch error:", txErr);
        }

        if (consecutiveErrorsRef.current >= CONSECUTIVE_ERROR_WARN_THRESHOLD) {
          logger.warn("[useTransactionHistory] multiple consecutive errors — check wallet connection.");
        }
      } finally {
        if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
        if (isMountedRef.current) {
          setIsInitialLoading(false);
          setIsRefreshing(false);
          setIsAutoRefreshing(false);
          setIsSlowRequest(false);
        }
      }
    },
    [firstKnownTxId],
  );

  // ── Initial fetch / wallet change ────────────────────────────────────────────

  useEffect(() => {
    if (!walletType || !address) {
      setPageCache(new Map());
      setFirstKnownTxId(null);
      setNewTxCount(0);
      setError(null);
      setCurrentPage(1);
      return;
    }

    // Clear cache for this address on wallet change
    clearTxCache(address);
    setPageCache(new Map());
    setCurrentPage(1);
    setFirstKnownTxId(null);
    setNewTxCount(0);
    fetchPage(1, { isInitial: true });
  }, [walletType, address]); // intentionally not including fetchPage in deps to avoid loops

  // ── Auto-refresh ─────────────────────────────────────────────────────────────

  const scheduleAutoRefresh = useCallback(() => {
    if (autoRefreshTimerRef.current) clearTimeout(autoRefreshTimerRef.current);
    autoRefreshTimerRef.current = setTimeout(async () => {
      if (!isMountedRef.current || !addressRef.current || !walletTypeRef.current) return;
      if (document.hidden) {
        scheduleAutoRefresh(); // re-schedule; page is hidden
        return;
      }
      await fetchPage(1, { isAuto: true });
      scheduleAutoRefresh();
    }, refreshIntervalMs);
  }, [fetchPage, refreshIntervalMs]);

  useEffect(() => {
    if (!walletType || !address) return;
    scheduleAutoRefresh();
    return () => {
      if (autoRefreshTimerRef.current) clearTimeout(autoRefreshTimerRef.current);
    };
  }, [walletType, address, scheduleAutoRefresh]);

  // Pause auto-refresh on hidden tab, resume on visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && walletTypeRef.current && addressRef.current) {
        // Tab became visible — schedule a fresh auto-refresh
        scheduleAutoRefresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [scheduleAutoRefresh]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (autoRefreshTimerRef.current) clearTimeout(autoRefreshTimerRef.current);
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    };
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(page);
      const nextApiPage = pageCache.size + 1;
      fetchPage(nextApiPage, { isManualRefresh: false });
    },
    [pageCache, fetchPage],
  );

  const refresh = useCallback(() => {
    if (!walletType || !address) return;
    clearTxCache(address);
    setPageCache(new Map());
    setCurrentPage(1);
    setFirstKnownTxId(null);
    setNewTxCount(0);
    fetchPage(1, { isManualRefresh: true });
  }, [walletType, address, fetchPage]);

  const jumpToNewTransactions = useCallback(() => {
    setNewTxCount(0);
    setCurrentPage(1);
  }, []);

  return {
    transactions: displayTxs,
    filter,
    setFilter,
    currentPage: safePage,
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
  };
}
