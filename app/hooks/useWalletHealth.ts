"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getActiveNetworkConfig, getHorizonUrl } from "@/app/lib/networkConfig";

export type ConnectionQuality = "excellent" | "good" | "degraded" | "offline";

export interface WalletHealthData {
  /** Whether the Horizon server responded successfully */
  horizonReachable: boolean;
  /** Round-trip latency to Horizon in ms, or null if unreachable */
  latencyMs: number | null;
  /** Derived connection quality bucket */
  connectionQuality: ConnectionQuality;
  /** Whether the account exists and is activated on-chain */
  accountActivated: boolean;
  /** Number of trustlines on the account */
  trustlineCount: number;
  /** Number of open DEX offers */
  offerCount: number;
  /** Current ledger sequence number from Horizon root */
  currentLedger: number | null;
  /** Horizon server version string */
  horizonVersion: string | null;
  /** Active Stellar network label */
  networkLabel: string;
  /** Horizon base URL being used */
  horizonUrl: string;
  /** Timestamp of the last successful check */
  lastCheckedAt: Date | null;
  /** Whether a health check is in progress */
  isChecking: boolean;
  /** Error message if the last check failed */
  error: string | null;
}

const QUALITY_THRESHOLDS = {
  excellent: 300,  // < 300 ms
  good: 800,       // 300–800 ms
  degraded: 2000,  // 800–2000 ms
  // > 2000 ms or unreachable → offline
};

function deriveQuality(latencyMs: number | null, reachable: boolean): ConnectionQuality {
  if (!reachable || latencyMs === null) return "offline";
  if (latencyMs < QUALITY_THRESHOLDS.excellent) return "excellent";
  if (latencyMs < QUALITY_THRESHOLDS.good) return "good";
  if (latencyMs < QUALITY_THRESHOLDS.degraded) return "degraded";
  return "offline";
}

const INITIAL_STATE: WalletHealthData = {
  horizonReachable: false,
  latencyMs: null,
  connectionQuality: "offline",
  accountActivated: false,
  trustlineCount: 0,
  offerCount: 0,
  currentLedger: null,
  horizonVersion: null,
  networkLabel: getActiveNetworkConfig().label,
  horizonUrl: getHorizonUrl(),
  lastCheckedAt: null,
  isChecking: false,
  error: null,
};

/**
 * Polls Horizon for wallet health metrics:
 * - Network reachability and latency
 * - Account activation status
 * - Trustline and offer counts
 * - Current ledger number
 *
 * @param publicKey  Stellar public key to check. Pass null to skip account checks.
 * @param intervalMs How often to re-run the check (default: 30 000 ms).
 */
export function useWalletHealth(
  publicKey: string | null,
  intervalMs = 30_000
) {
  const [data, setData] = useState<WalletHealthData>(INITIAL_STATE);
  const isMountedRef = useRef(true);

  const runCheck = useCallback(async () => {
    if (!isMountedRef.current) return;

    setData((prev: WalletHealthData) => ({ ...prev, isChecking: true, error: null }));

    const horizonUrl = getHorizonUrl();

    // ── 1. Ping Horizon root for latency + ledger info ──────────────────────
    let horizonReachable = false;
    let latencyMs: number | null = null;
    let currentLedger: number | null = null;
    let horizonVersion: string | null = null;

    try {
      const t0 = performance.now();
      const rootRes = await fetch(`${horizonUrl}/`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      latencyMs = Math.round(performance.now() - t0);

      if (rootRes.ok) {
        horizonReachable = true;
        const root = await rootRes.json();
        currentLedger = root.core_latest_ledger ?? null;
        horizonVersion = root.horizon_version ?? null;
      }
    } catch {
      // Network error or timeout — horizonReachable stays false
    }

    // ── 2. Fetch account details if we have a public key ────────────────────
    let accountActivated = false;
    let trustlineCount = 0;
    let offerCount = 0;

    if (publicKey && horizonReachable) {
      try {
        const acctRes = await fetch(`${horizonUrl}/accounts/${publicKey}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        });

        if (acctRes.ok) {
          accountActivated = true;
          const acct = await acctRes.json();
          // Non-native balances = trustlines
          trustlineCount = (acct.balances ?? []).filter(
            (b: { asset_type: string }) => b.asset_type !== "native"
          ).length;
          offerCount = acct.num_selling_liabilities
            ? parseInt(acct.num_selling_liabilities, 10)
            : 0;
        }
        // 404 → account not yet activated, leave defaults
      } catch {
        // Ignore per-account errors; Horizon reachability already captured
      }
    }

    if (!isMountedRef.current) return;

    setData({
      horizonReachable,
      latencyMs,
      connectionQuality: deriveQuality(latencyMs, horizonReachable),
      accountActivated,
      trustlineCount,
      offerCount,
      currentLedger,
      horizonVersion,
      networkLabel: getActiveNetworkConfig().label,
      horizonUrl,
      lastCheckedAt: new Date(),
      isChecking: false,
      error: horizonReachable ? null : "Cannot reach Horizon. Check your connection.",
    });
  }, [publicKey]);

  // Run immediately on mount and whenever publicKey changes, then poll.
  useEffect(() => {
    isMountedRef.current = true;
    runCheck();

    const timer = setInterval(runCheck, intervalMs);
    return () => {
      isMountedRef.current = false;
      clearInterval(timer);
    };
  }, [runCheck, intervalMs]);

  return { ...data, refresh: runCheck };
}
