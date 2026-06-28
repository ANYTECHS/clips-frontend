"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { BALANCE_REFRESH_INTERVAL_MS, PRICE_CACHE_TTL_MS } from "@/app/lib/constants";
import { logger } from "@/app/lib/logger";

/**
 * Balance data structure
 */
export interface Balance {
  /** The formatted base-10 native asset balance representation string */
  xlm: string;
  /** Numeric representation of native asset units */
  xlmRaw: number;
  /** Calculated valuation value string mapped directly to USD */
  usd: string;
  /** Raw dynamic numeric scaling factor for calculated USD value */
  usdRaw: number;
  /** Timestamp reference noting completion of sync lifecycle tracking */
  lastUpdated: Date;
  /** All non-native Stellar asset balances */
  otherAssets: AssetBalance[];
  /** True when USD value uses a cached price after a rate-limit or fetch failure */
  isPriceStale?: boolean;
}

/** A non-native Stellar asset balance */
export interface AssetBalance {
  /** Dynamic alphanumeric asset tag specifier */
  code: string;
  /** Public address identity string linking back to the origin root mint */
  issuer: string;
  /** Formatted text block showing available balance quantity */
  balance: string;
  /** Numerical variable notation representing the floating token capacity */
  balanceRaw: number;
}

/**
 * Balance error structure
 */
export interface BalanceError {
  /** Programmatic error identification string context */
  code: string;
  /** Description parsing exception failure metrics for tracking */
  message: string;
}

/**
 * Hook options
 */
export interface UseBalanceOptions {
  /** Public key to fetch balance for */
  publicKey: string | null;
  /** Network to use (PUBLIC for mainnet, TESTNET for testnet) */
  network?: "PUBLIC" | "TESTNET";
  /** Auto-refresh interval in milliseconds (default: 30000 = 30 seconds) */
  refreshInterval?: number;
  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  /**
   * Use Horizon's live SSE stream (server.payments / server.effects) to
   * push balance updates instantly when funds arrive. Falls back to the
   * polling interval if the browser does not support EventSource.
   * (default: true)
   */
  enableStreaming?: boolean;
  /** XLM/USD price cache TTL in milliseconds (default: 300000 = 5 minutes) */
  priceCacheTtlMs?: number;
  /** Callback when balance is successfully fetched */
  onSuccess?: (balance: Balance) => void;
  /** Callback when balance fetch fails */
  onError?: (error: BalanceError) => void;
}

/**
 * Hook state
 */
export interface UseBalanceState {
  /** Complete structure context mapping native and trustline holdings data */
  balance: Balance | null;
  /** Structural visibility identifier for async resolution states */
  isLoading: boolean;
  /** Captured runtime exception code references */
  error: BalanceError | null;
  /** Time parameter recording final resolution confirmation */
  lastFetchTime: Date | null;
  /** True when the displayed USD value uses a stale cached XLM price */
  isPriceStale: boolean;
}

/**
 * Get balance from Horizon server
 *
 * @param publicKey - Stellar public key.
 * @param network - Network to use (PUBLIC or TESTNET).
 * @returns Balance data structured payload containing raw and string values.
 * @throws {BalanceError} Rethrows structured network codes, 404 targets, or unknown wrapper states.
 */
export async function getBalance(
  publicKey: string,
  network: "PUBLIC" | "TESTNET" = "TESTNET"
): Promise<Balance> {
  const horizonUrl =
    network === "PUBLIC"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org";

  try {
    const response = await fetch(`${horizonUrl}/accounts/${publicKey}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw {
          code: "ACCOUNT_NOT_FOUND",
          message: "Account not found. Fund your account to activate it on the Stellar network.",
        };
      }
      throw {
        code: "FETCH_ERROR",
        message: `Failed to fetch account data: ${response.statusText}`,
      };
    }

    const accountData = await response.json();

    const xlmBalance = accountData.balances.find(
      (b: any) => b.asset_type === "native"
    );

    if (!xlmBalance) {
      throw {
        code: "NO_BALANCE",
        message: "No XLM balance found for this account",
      };
    }

    const xlmAmount = parseFloat(xlmBalance.balance);

    const otherAssets: AssetBalance[] = accountData.balances
      .filter((b: any) => b.asset_type !== "native")
      .map((b: any) => ({
        code: b.asset_code ?? b.asset_type,
        issuer: b.asset_issuer ?? "",
        balance: parseFloat(b.balance).toFixed(7),
        balanceRaw: parseFloat(b.balance),
      }));

    const xlmPriceResult = await fetchXLMPrice();
    const usdValue = xlmAmount * xlmPriceResult.price;

    return {
      xlm: xlmAmount.toFixed(7),
      xlmRaw: xlmAmount,
      usd: usdValue.toFixed(2),
      usdRaw: usdValue,
      lastUpdated: new Date(),
      otherAssets,
      isPriceStale: xlmPriceResult.isStale,
    };
  } catch (err: any) {
    if (err.code && err.message) {
      throw err;
    }

    throw {
      code: "UNKNOWN_ERROR",
      message: err instanceof Error ? err.message : "Failed to fetch balance",
    };
  }
}

const DEFAULT_PRICE_CACHE_TTL_MS = PRICE_CACHE_TTL_MS;
const FALLBACK_XLM_PRICE_USD = parseFloat(
  process.env.NEXT_PUBLIC_XLM_FALLBACK_PRICE_USD ?? "0.12"
);

interface XlmPriceCacheEntry {
  price: number;
  expiresAt: number;
}

interface XlmPriceResult {
  price: number;
  isStale: boolean;
}

let _xlmPriceCache: XlmPriceCacheEntry | null = null;
let _xlmPriceFetch: Promise<XlmPriceResult> | null = null;
let _priceCacheTtlMs = DEFAULT_PRICE_CACHE_TTL_MS;

/**
 * Updates the local configuration lifetime mapping for pricing caches.
 *
 * @param ttlMs - Expiry mapping time limits measured in milliseconds.
 */
export function configureXlmPriceCacheTtl(ttlMs: number): void {
  _priceCacheTtlMs = ttlMs;
}

/**
 * Clears volatile pricing registers, wiping historical rates, references, and caches.
 */
export function resetXlmPriceCache(): void {
  _xlmPriceCache = null;
  _xlmPriceFetch = null;
  _priceCacheTtlMs = DEFAULT_PRICE_CACHE_TTL_MS;
}

/**
 * Evaluates pricing conditions, resolving via active routes or falling back safely to historical cache boundaries.
 *
 * @returns Object context resolving ticker pricing parameters along with status indicators.
 */
export async function fetchXLMPrice(): Promise<XlmPriceResult> {
  const now = Date.now();
  if (_xlmPriceCache && now < _xlmPriceCache.expiresAt) {
    return { price: _xlmPriceCache.price, isStale: false };
  }
  if (_xlmPriceFetch) return _xlmPriceFetch;

  _xlmPriceFetch = (async (): Promise<XlmPriceResult> => {
    try {
      const response = await fetch("/api/prices/xlm");
      if (response.ok) {
        const data: { price: number; stale: boolean } = await response.json();
        if (typeof data.price === "number") {
          if (!data.stale) {
            _xlmPriceCache = { price: data.price, expiresAt: Date.now() + _priceCacheTtlMs };
          }
          return { price: data.price, isStale: data.stale };
        }
      }
    } catch (err) {
      logger.warn("Failed to fetch XLM price:", err);
    } finally {
      _xlmPriceFetch = null;
    }

    if (_xlmPriceCache) {
      return { price: _xlmPriceCache.price, isStale: true };
    }
    return { price: FALLBACK_XLM_PRICE_USD, isStale: true };
  })();

  return _xlmPriceFetch;
}

/**
 * Custom hook for fetching and managing Stellar account balance.
 *
 * @param options - Instantiation hooks managing interval, configurations, targets, and routes.
 * @returns Compiled state indicators, interaction wrappers, and streaming references.
 */
export function useBalance(options: UseBalanceOptions) {
  const {
    publicKey,
    network = "TESTNET",
    refreshInterval = BALANCE_REFRESH_INTERVAL_MS,
    autoRefresh = true,
    enableStreaming = true,
    priceCacheTtlMs = DEFAULT_PRICE_CACHE_TTL_MS,
    onSuccess,
    onError,
  } = options;

  const [balance, setBalance] = useState<Balance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<BalanceError | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [isPriceStale, setIsPriceStale] = useState(false);

  useEffect(() => {
    configureXlmPriceCacheTtl(priceCacheTtlMs);
  }, [priceCacheTtlMs]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const streamRef = useRef<EventSource | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  /**
   * Internal mechanism orchestrating live connection fetching routines.
   */
  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      setIsLoading(false);
      setError(null);
      setLastFetchTime(null);
      setIsPriceStale(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getBalance(publicKey, network);

      if (isMountedRef.current) {
        setBalance(result);
        setIsLoading(false);
        setError(null);
        setLastFetchTime(new Date());
        setIsPriceStale(result.isPriceStale ?? false);

        onSuccessRef.current?.(result);
      }
    } catch (err: any) {
      const balanceError: BalanceError = {
        code: err.code || "UNKNOWN_ERROR",
        message: err.message || "Failed to fetch balance",
      };

      if (isMountedRef.current) {
        setIsLoading(false);
        setError(balanceError);

        onErrorRef.current?.(balanceError);
      }
    }
  }, [publicKey, network]);

  /**
   * Action trigger context forcing a manual retrieval call bypassing core loops.
   */
  const refresh = useCallback(() => {
    fetchBalance();
  }, [fetchBalance]);

  /**
   * Resets active validation error contexts inside regional hook loops.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (publicKey) {
      fetchBalance();

      if (autoRefresh && refreshInterval > 0) {
        intervalRef.current = setInterval(() => {
          fetchBalance();
        }, refreshInterval);
      }
    } else {
      setBalance(null);
      setIsLoading(false);
      setError(null);
      setLastFetchTime(null);
      setIsPriceStale(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [publicKey, network, autoRefresh, refreshInterval, fetchBalance]);

  useEffect(() => {
    if (!publicKey || !enableStreaming || typeof EventSource === "undefined") return;

    const horizonUrl =
      network === "PUBLIC"
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org";

    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }

    const es = new EventSource(
      `${horizonUrl}/accounts/${publicKey}/payments?cursor=now`
    );

    es.addEventListener("message", () => {
      fetchBalance();
    });

    es.addEventListener("error", () => {
    });

    streamRef.current = es;

    return () => {
      es.close();
      streamRef.current = null;
    };
  }, [publicKey, network, enableStreaming, fetchBalance]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
      }
    };
  }, []);

  return useMemo(() => ({
    balance,
    isLoading,
    error,
    lastFetchTime,
    isPriceStale,

    refresh,
    clearError,

    isAutoRefreshing: autoRefresh && !!publicKey && refreshInterval > 0,
    isStreaming: enableStreaming && !!publicKey && typeof EventSource !== "undefined",
  }), [balance, isLoading, error, lastFetchTime, isPriceStale, refresh, clearError, autoRefresh, publicKey, refreshInterval, enableStreaming]);
}
