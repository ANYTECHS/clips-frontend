"use client";

import React from "react";
import { Loader2, RefreshCw, AlertCircle, TrendingUp, Clock } from "lucide-react";
import { useBalance } from "@/app/hooks/useBalance";

interface BalanceDisplayProps {
  /** Stellar public key */
  publicKey: string | null;
  /** Network (PUBLIC for mainnet, TESTNET for testnet) */
  network?: "PUBLIC" | "TESTNET";
  /** Auto-refresh interval in milliseconds (default: 30000 = 30 seconds) */
  refreshInterval?: number;
  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  /** Display mode: "full" shows both XLM and USD, "compact" shows only XLM */
  mode?: "full" | "compact";
  /** Show last update time */
  showLastUpdate?: boolean;
  /** Show refresh button */
  showRefreshButton?: boolean;
  /** Custom className for styling */
  className?: string;
}

/**
 * Balance Display Component
 * 
 * Displays Stellar account balance with auto-refresh functionality
 * 
 * @example
 * ```tsx
 * <BalanceDisplay
 *   publicKey="GTEST123..."
 *   network="TESTNET"
 *   refreshInterval={30000}
 *   autoRefresh={true}
 *   mode="full"
 *   showLastUpdate={true}
 * />
 * ```
 */
export default function BalanceDisplay({
  publicKey,
  network = "TESTNET",
  refreshInterval = 30000,
  autoRefresh = true,
  mode = "full",
  showLastUpdate = true,
  showRefreshButton = true,
  className = "",
}: BalanceDisplayProps) {
  const {
    balance,
    isLoading,
    error,
    lastFetchTime,
    refresh,
    clearError,
    isAutoRefreshing,
  } = useBalance({
    publicKey,
    network,
    refreshInterval,
    autoRefresh,
  });

  // Format last update time
  const formatLastUpdate = (date: Date | null): string => {
    if (!date) return "";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 10) return "Just now";
    if (diffSecs < 60) return `${diffSecs}s ago`;
    
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  // If no public key, show placeholder
  if (!publicKey) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-muted text-[13px]">
          Connect your wallet to view balance
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading && !balance) {
    return (
      <div className={`flex items-center justify-center py-6 ${className}`}>
        <Loader2 className="w-6 h-6 text-brand animate-spin" />
      </div>
    );
  }

  // Error state
  if (error && !balance) {
    return (
      <div className={`${className}`}>
        <div className="flex items-start gap-2 p-4 bg-error/10 border border-error/30 rounded-xl">
          <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-error text-[13px] leading-relaxed mb-2">
              {error.message}
            </p>
            <button
              onClick={() => {
                clearError();
                refresh();
              }}
              className="text-[12px] text-error hover:underline font-medium"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Balance display
  if (!balance) {
    return null;
  }

  // Compact mode - only XLM
  if (mode === "compact") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex items-baseline gap-2">
          <span className="text-[20px] font-black text-white">
            {balance.xlm}
          </span>
          <span className="text-[13px] text-muted font-medium">XLM</span>
        </div>
        
        {showRefreshButton && (
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
            title="Refresh balance"
          >
            <RefreshCw
              className={`w-4 h-4 text-muted hover:text-white ${
                isLoading ? "animate-spin" : ""
              }`}
            />
          </button>
        )}
      </div>
    );
  }

  // Full mode - XLM and USD
  return (
    <div className={`space-y-4 ${className}`}>
      {/* XLM Balance */}
      <div className="p-4 bg-surface-hover border border-border rounded-xl">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[12px] text-muted font-medium uppercase tracking-wider">
            XLM Balance
          </span>
          {showRefreshButton && (
            <button
              onClick={refresh}
              disabled={isLoading}
              className="p-1 rounded hover:bg-surface transition-colors disabled:opacity-50"
              title="Refresh balance"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-muted hover:text-white ${
                  isLoading ? "animate-spin" : ""
                }`}
              />
            </button>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-black text-white">
            {balance.xlm}
          </span>
          <span className="text-[14px] text-muted font-medium">XLM</span>
        </div>
      </div>

      {/* USD Value */}
      <div className="p-4 bg-surface-hover border border-border rounded-xl">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[12px] text-muted font-medium uppercase tracking-wider">
            USD Value
          </span>
          <TrendingUp className="w-3.5 h-3.5 text-brand" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[24px] font-bold text-brand">
            ${balance.usd}
          </span>
          <span className="text-[12px] text-muted">USD</span>
        </div>
      </div>

      {/* Last Update & Auto-refresh Indicator */}
      {(showLastUpdate || isAutoRefreshing) && (
        <div className="flex items-center justify-between text-[11px] text-muted">
          {showLastUpdate && lastFetchTime && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span>Updated {formatLastUpdate(lastFetchTime)}</span>
            </div>
          )}
          
          {isAutoRefreshing && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              <span>Auto-refresh: {refreshInterval / 1000}s</span>
            </div>
          )}
        </div>
      )}

      {/* Error indicator (if balance exists but there's an error on refresh) */}
      {error && balance && (
        <div className="flex items-center gap-2 p-2 bg-error/10 border border-error/30 rounded-lg">
          <AlertCircle className="w-3 h-3 text-error shrink-0" />
          <p className="text-error text-[11px] flex-1">
            Failed to refresh: {error.message}
          </p>
          <button
            onClick={clearError}
            className="text-error hover:text-error/70 text-[10px] font-medium"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
