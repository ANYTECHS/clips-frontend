"use client";

import { AlertCircle, CheckCircle2, Loader2, MinusCircle, RefreshCw, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useOptionalNetworkContext } from "@/app/context/NetworkContext";
import { useAutoStellarWallet } from "@/app/hooks/useAutoStellarWallet";
import { useWalletDiagnostics } from "@/app/hooks/useWalletDiagnostics";
import { sanitize } from "@/app/lib/sanitize";
import {
  type DiagnosticCheck,
  type DiagnosticFix,
  fundWithFriendbot,
} from "@/app/lib/walletDiagnostics";

export interface WalletHealthCardProps {
  /** Wallet to diagnose. Falls back to the signed-in user's Stellar wallet. */
  publicKey?: string | null;
}

function StatusIcon({ status }: { status: DiagnosticCheck["status"] }) {
  if (status === "pass") {
    return <CheckCircle2 className="w-4 h-4 text-brand shrink-0" aria-label="Passed" />;
  }
  if (status === "fail") {
    return <AlertCircle className="w-4 h-4 text-error shrink-0" aria-label="Failed" />;
  }
  return <MinusCircle className="w-4 h-4 text-muted shrink-0" aria-label="Skipped" />;
}

const fixButtonClass =
  "shrink-0 px-2.5 py-1 rounded-lg border border-error/30 text-error text-[11px] font-semibold hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-50";

function FixAction({
  fix,
  onFund,
  onRetry,
  busy,
}: {
  fix: DiagnosticFix;
  onFund: () => void;
  onRetry: () => void;
  busy: boolean;
}) {
  if (fix.kind === "link") {
    const external = /^https?:\/\//.test(fix.href);
    return external ? (
      <a href={fix.href} target="_blank" rel="noopener noreferrer" className={fixButtonClass}>
        {fix.label}
      </a>
    ) : (
      <Link href={fix.href} className={fixButtonClass}>
        {fix.label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={fix.kind === "fund" ? onFund : onRetry}
      disabled={busy}
      className={fixButtonClass}
    >
      {fix.label}
    </button>
  );
}

export default function WalletHealthCard({ publicKey: publicKeyProp }: WalletHealthCardProps = {}) {
  const auto = useAutoStellarWallet();
  const networkContext = useOptionalNetworkContext();
  const publicKey = publicKeyProp ?? auto.publicKey;
  const network = networkContext?.network ?? auto.network;

  const { report, running, runError, refresh } = useWalletDiagnostics(publicKey, network);
  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);

  if (!publicKey) {
    return null;
  }

  const handleFund = async () => {
    setFunding(true);
    setFundError(null);
    try {
      await fundWithFriendbot(publicKey, network);
      refresh();
    } catch {
      setFundError("Funding failed. Try again in a moment.");
    } finally {
      setFunding(false);
    }
  };

  const failedCount = report?.checks.filter((c) => c.status === "fail").length ?? 0;

  return (
    <div
      className="bg-surface border border-border rounded-[24px] p-6 space-y-4"
      aria-busy={running}
      data-testid="wallet-health-card"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">Wallet Health</h3>
          {running ? (
            <Loader2 className="w-4 h-4 text-brand animate-spin" aria-label="Running diagnostics" />
          ) : report ? (
            report.healthy ? (
              <CheckCircle2 className="w-4 h-4 text-brand" aria-label="Healthy" />
            ) : (
              <AlertCircle className="w-4 h-4 text-error" aria-label="Issues found" />
            )
          ) : (
            <Wallet className="w-4 h-4 text-muted" aria-hidden />
          )}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={running}
          aria-label="Refresh wallet diagnostics"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-muted hover:text-white hover:border-brand/30 text-[12px] font-medium transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </button>
      </div>

      {auto.status === "ready" && auto.balance && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted text-[12px]">Balance</span>
            <span className="text-white font-bold">{auto.balance.xlm} XLM</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted text-[12px]">Network</span>
            <span className="text-white font-bold">
              {network === "mainnet" ? "Mainnet" : "Testnet"}
            </span>
          </div>
        </div>
      )}

      {!report && running && <p className="text-muted text-[13px]">Running diagnostics...</p>}

      {report && (
        <>
          <p className="text-[12px] text-muted" aria-live="polite">
            {report.healthy
              ? "All checks passed."
              : `${failedCount} check${failedCount === 1 ? "" : "s"} failed.`}
          </p>
          <ul className="space-y-2" aria-label="Wallet diagnostics">
            {report.checks.map((check) => (
              <li
                key={check.id}
                data-testid={`diagnostic-${check.id}`}
                data-status={check.status}
                className={`flex items-start gap-3 rounded-xl px-3 py-2.5 border ${
                  check.status === "fail"
                    ? "bg-error/5 border-error/20"
                    : "bg-white/[0.01] border-border"
                }`}
              >
                <StatusIcon status={check.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[12px] font-semibold">{check.label}</p>
                  <p
                    className={`text-[12px] ${check.status === "fail" ? "text-error" : "text-muted"}`}
                  >
                    {sanitize(check.message)}
                  </p>
                </div>
                {check.status === "fail" && check.fix && (
                  <FixAction
                    fix={check.fix}
                    onFund={handleFund}
                    onRetry={refresh}
                    busy={funding || running}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {(runError || fundError) && (
        <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3" role="alert">
          <p className="text-error text-[13px]">
            {fundError ?? "Diagnostics could not complete. Check your connection and refresh."}
          </p>
        </div>
      )}
    </div>
  );
}
