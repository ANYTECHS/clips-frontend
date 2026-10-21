"use client";

/**
 * useWalletDiagnostics
 *
 * Runs the wallet health diagnostics from app/lib/walletDiagnostics.ts and
 * exposes the latest report. Follows the useServiceHealth pattern:
 *  - First run fires on mount (and whenever the wallet or network changes).
 *  - `refresh()` re-runs every check on demand.
 *  - A failed run never crashes the tree; the last report is preserved.
 *  - Runs are skipped while the tab is hidden, and fire again when it
 *    becomes visible if a run was skipped.
 *
 * Each completed run is logged to analytics so common failure modes
 * (unfunded accounts, missing trustlines, RPC outages) can be tracked.
 *
 * Usage:
 * ```tsx
 * const { report, running, refresh } = useWalletDiagnostics(publicKey, network);
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { analytics } from "@/app/lib/analytics";
import { logger } from "@/app/lib/logger";
import type { StellarNetwork } from "@/app/lib/networkConfig";
import { type DiagnosticReport, runWalletDiagnostics } from "@/app/lib/walletDiagnostics";

export interface WalletDiagnosticsState {
  report: DiagnosticReport | null;
  /** True while a diagnostic run is in progress. */
  running: boolean;
  /** Error message if the last run failed unexpectedly, or null. */
  runError: string | null;
  /** Re-run all checks immediately. */
  refresh: () => void;
}

export function useWalletDiagnostics(
  publicKey: string | null,
  network: StellarNetwork,
  options: { timeoutMs?: number } = {}
): WalletDiagnosticsState {
  const { timeoutMs } = options;
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const runIdRef = useRef(0);
  const pendingWhileHiddenRef = useRef(false);

  const run = useCallback(async () => {
    if (!publicKey) return;

    // Don't run when the tab is in the background — run once it's visible.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      pendingWhileHiddenRef.current = true;
      return;
    }
    pendingWhileHiddenRef.current = false;

    const runId = ++runIdRef.current;
    setRunning(true);
    try {
      const next = await runWalletDiagnostics({ publicKey, network, timeoutMs });
      if (!isMountedRef.current || runId !== runIdRef.current) return;

      setReport(next);
      setRunError(null);

      const failed = next.checks.filter((c) => c.status === "fail");
      analytics.trackEvent("wallet_health_check", {
        network,
        healthy: next.healthy,
        failedChecks: failed.map((c) => c.id).join(",") || "none",
        timedOutChecks:
          failed
            .filter((c) => c.timedOut)
            .map((c) => c.id)
            .join(",") || "none",
      });
    } catch (err) {
      if (!isMountedRef.current || runId !== runIdRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      logger.warn("[useWalletDiagnostics] Run failed:", message);
      setRunError(message);
    } finally {
      if (isMountedRef.current && runId === runIdRef.current) {
        setRunning(false);
      }
    }
  }, [publicKey, network, timeoutMs]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!publicKey) {
      setReport(null);
      setRunError(null);
      setRunning(false);
      return;
    }
    void run();
    return () => {
      // Invalidate in-flight runs for the previous wallet/network.
      runIdRef.current++;
    };
  }, [publicKey, run]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && pendingWhileHiddenRef.current) {
        void run();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [run]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    void run();
  }, [run]);

  return { report, running, runError, refresh };
}
