"use client";

import React from "react";
import {
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Server,
  Link as LinkIcon,
  Layers,
} from "lucide-react";
import { useWalletHealth, type ConnectionQuality } from "@/app/hooks/useWalletHealth";
import { STELLAR_NETWORK } from "@/app/lib/networkConfig";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const QUALITY_CONFIG: Record<
  ConnectionQuality,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  excellent: {
    label: "Excellent",
    color: "text-brand",
    bg: "bg-brand/10",
    border: "border-brand/20",
    icon: <Wifi className="w-3.5 h-3.5" aria-hidden="true" />,
  },
  good: {
    label: "Good",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
    icon: <Wifi className="w-3.5 h-3.5" aria-hidden="true" />,
  },
  degraded: {
    label: "Degraded",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/20",
    icon: <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />,
  },
  offline: {
    label: "Offline",
    color: "text-error",
    bg: "bg-error/10",
    border: "border-error/30",
    icon: <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />,
  },
};

function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  return `${ms} ms`;
}

function formatTime(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface RowProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}

function Row({ label, value, icon }: RowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-[12px] font-medium">{label}</span>
      </div>
      <div className="text-[12px] font-bold text-white">{value}</div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WalletHealthCardProps {
  /** Stellar public key. Pass null when no wallet is connected. */
  publicKey: string | null;
  /** Poll interval in ms (default: 30 000) */
  intervalMs?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WalletHealthCard({
  publicKey,
  intervalMs = 30_000,
}: WalletHealthCardProps) {
  const health = useWalletHealth(publicKey, intervalMs);
  const quality = QUALITY_CONFIG[health.connectionQuality];

  const explorerBase =
    STELLAR_NETWORK === "mainnet"
      ? "https://stellar.expert/explorer/public"
      : "https://stellar.expert/explorer/testnet";

  return (
    <div className="bg-surface border border-border rounded-[24px] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] text-muted font-medium uppercase tracking-wider">
              Wallet Health
            </p>
            <p className="text-[16px] font-black text-white leading-tight">
              {health.networkLabel} Network
            </p>
          </div>
        </div>

        {/* Connection quality badge */}
        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${quality.color} ${quality.bg} ${quality.border}`}
          aria-label={`Connection quality: ${quality.label}`}
        >
          {health.isChecking ? (
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            quality.icon
          )}
          {health.isChecking ? "Checking…" : quality.label}
        </span>
      </div>

      {/* Error banner */}
      {health.error && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 bg-error/10 border border-error/30 rounded-xl px-4 py-3 mb-4"
        >
          <XCircle className="w-4 h-4 text-error shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-error text-[12px] leading-relaxed">{health.error}</p>
        </div>
      )}

      {/* Metrics grid */}
      <div className="rounded-xl bg-surface-hover border border-border px-4 mb-4">
        <Row
          label="Horizon Status"
          icon={<Server className="w-3.5 h-3.5" aria-hidden="true" />}
          value={
            health.horizonReachable ? (
              <span className="flex items-center gap-1 text-brand">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Reachable
              </span>
            ) : (
              <span className="flex items-center gap-1 text-error">
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                Unreachable
              </span>
            )
          }
        />

        <Row
          label="Latency"
          icon={<Activity className="w-3.5 h-3.5" aria-hidden="true" />}
          value={
            <span className={health.latencyMs !== null && health.latencyMs < 800 ? "text-brand" : "text-yellow-400"}>
              {formatLatency(health.latencyMs)}
            </span>
          }
        />

        <Row
          label="Network"
          icon={<Wifi className="w-3.5 h-3.5" aria-hidden="true" />}
          value={
            <span className={STELLAR_NETWORK === "mainnet" ? "text-brand" : "text-yellow-400"}>
              {health.networkLabel}
            </span>
          }
        />

        <Row
          label="Current Ledger"
          icon={<Layers className="w-3.5 h-3.5" aria-hidden="true" />}
          value={health.currentLedger?.toLocaleString() ?? "—"}
        />

        <Row
          label="Account Status"
          icon={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
          value={
            !publicKey ? (
              <span className="text-muted">Not connected</span>
            ) : health.accountActivated ? (
              <span className="flex items-center gap-1 text-brand">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Activated
              </span>
            ) : (
              <span className="flex items-center gap-1 text-yellow-400">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                Not funded
              </span>
            )
          }
        />

        {publicKey && health.accountActivated && (
          <>
            <Row
              label="Trustlines"
              icon={<LinkIcon className="w-3.5 h-3.5" aria-hidden="true" />}
              value={health.trustlineCount}
            />
            <Row
              label="Open Offers"
              icon={<Activity className="w-3.5 h-3.5" aria-hidden="true" />}
              value={health.offerCount}
            />
          </>
        )}

        {health.horizonVersion && (
          <Row
            label="Horizon Version"
            icon={<Server className="w-3.5 h-3.5" aria-hidden="true" />}
            value={
              <span className="text-muted font-mono text-[11px]">
                {health.horizonVersion}
              </span>
            }
          />
        )}
      </div>

      {/* Footer: last checked + actions */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted">
          {health.lastCheckedAt
            ? `Last checked ${formatTime(health.lastCheckedAt)}`
            : "Checking…"}
        </p>

        <div className="flex items-center gap-2">
          {publicKey && (
            <a
              href={`${explorerBase}/account/${publicKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-border border border-border text-muted hover:text-white text-[11px] font-medium transition-colors"
              aria-label="View account on Stellar Explorer (opens in new tab)"
            >
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
              Explorer
            </a>
          )}

          <button
            onClick={health.refresh}
            disabled={health.isChecking}
            aria-label={health.isChecking ? "Health check in progress" : "Refresh health check"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 hover:bg-brand/20 border border-brand/20 text-brand text-[11px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={`w-3 h-3 ${health.isChecking ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
