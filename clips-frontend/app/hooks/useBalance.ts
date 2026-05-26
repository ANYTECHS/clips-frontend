"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Balance data structure
 */
export interface Balance {
  xlm: string;
  xlmRaw: number;
  usd: string;
  usdRaw: number;
  lastUpdated: Date;
}

/**
 * Balance error structure
 */
export interface BalanceError {
  code: string;
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
  /** Callback when balance is successfully fetched */
  onSuccess?: (balance: Balance) => void;
  /** Callback when balance fetch fails */
  onError?: (error: BalanceError) => void;
}

/**
 * Hook state
 */
export interface UseBalanceState {
  balance: Balance | null;
  isLoading: boolean;
  error: BalanceError | null;
  lastFetchTime: Date | null;
}

/**
 * Get balance from Horizon server
 * 
 * @param publicKey - Stellar public key
 * @param network - Network to use (PUBLIC or TESTNET)
 * @returns Balance data
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
    // Fetch account data from Horizon
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

    // Find native XLM balance
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

    // Fetch current XLM price in USD
    const xlmPriceUSD = await fetchXLMPrice();
    const usdValue = xlmAmount * xlmPriceUSD;

    return {
      xlm: xlmAmount.toFixed(7), // Stellar uses 7 decimal places
      xlmRaw: xlmAmount,
      usd: usdValue.toFixed(2),
      usdRaw: usdValue,
      lastUpdated: new Date(),
    };
  } catch (err: any) {
    // If error already has code and message, throw it as is
    if (err.code && err.message) {
      throw err;
    }

    // Otherwise, wrap it
    throw {
      code: "UNKNOWN_ERROR",
      message: err instanceof Error ? err.message : "Failed to fetch balance",
    };
  }
}

/**
 * Fetch current XLM price in USD
 * 
 * @returns XLM price in USD
 */
async function fetchXLMPrice(): Promise<number> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd",
      {
        // Add cache control to avoid rate limiting
        headers: {
          "Cache-Control": "public, max-age=60",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const price = data.stellar?.usd;
      
      if (price && typeof price === "number") {
        return price;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch XLM price from CoinGecko:", err);
  }

  // Fallback price (approximate)
  return 0.12;
}

/**
 * Custom hook for fetching and managing Stellar account balance
 * 
 * Features:
 * - Automatic balance fetching when publicKey is provided
 * - Auto-refresh at configurable intervals (default: 30 seconds)
 * - Manual refresh capability
 * - Loading and error states
 * - Success/error callbacks
 * 
 * @example
 * ```tsx
 * const { balance, isLoading, error, refresh } = useBalance({
 *   publicKey: "GTEST123...",
 *   network: "TESTNET",
 *   refreshInterval: 30000, // 30 seconds
 *   autoRefresh: true,
 * });
 * 
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 * if (balance) return <div>{balance.xlm} XLM</div>;
 * ```
 */
export function useBalance(options: UseBalanceOptions) {
  const {
    publicKey,
    network = "TESTNET",
    refreshInterval = 30000, // 30 seconds default
    autoRefresh = true,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<UseBalanceState>({
    balance: null,
    isLoading: false,
    error: null,
    lastFetchTime: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Fetch balance
   */
  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setState({
        balance: null,
        isLoading: false,
        error: null,
        lastFetchTime: null,
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const balance = await getBalance(publicKey, network);

      if (isMountedRef.current) {
        setState({
          balance,
          isLoading: false,
          error: null,
          lastFetchTime: new Date(),
        });

        onSuccess?.(balance);
      }
    } catch (err: any) {
      const error: BalanceError = {
        code: err.code || "UNKNOWN_ERROR",
        message: err.message || "Failed to fetch balance",
      };

      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error,
        }));

        onError?.(error);
      }
    }
  }, [publicKey, network, onSuccess, onError]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(() => {
    fetchBalance();
  }, [fetchBalance]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  /**
   * Initial fetch and auto-refresh setup
   */
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Fetch immediately if we have a public key
    if (publicKey) {
      fetchBalance();

      // Set up auto-refresh if enabled
      if (autoRefresh && refreshInterval > 0) {
        intervalRef.current = setInterval(() => {
          fetchBalance();
        }, refreshInterval);
      }
    } else {
      // Clear state if no public key
      setState({
        balance: null,
        isLoading: false,
        error: null,
        lastFetchTime: null,
      });
    }

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [publicKey, network, autoRefresh, refreshInterval, fetchBalance]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    // State
    balance: state.balance,
    isLoading: state.isLoading,
    error: state.error,
    lastFetchTime: state.lastFetchTime,

    // Actions
    refresh,
    clearError,

    // Utilities
    isAutoRefreshing: autoRefresh && !!publicKey && refreshInterval > 0,
  };
}
