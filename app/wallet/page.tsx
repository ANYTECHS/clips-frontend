"use client";

import React, { useState, useMemo, useEffect } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useAutoStellarWallet } from "@/app/hooks/useAutoStellarWallet";
import { useBalance, type AssetBalance } from "@/app/hooks/useBalance";
import { BALANCE_REFRESH_INTERVAL_MS } from "@/app/lib/constants";
import { useNetworkOverride } from "@/app/hooks/useNetworkOverride";
import { getFreighterNetwork } from "@/app/lib/networkConfig";
import {
  Wallet,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";

// ─── Donut Chart ──────────────────────────────────────────────────────────────

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

function DonutChart({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const R = 60;
  const cx = 80;
  const cy = 80;
  const strokeWidth = 22;

  let cumulative = 0;
  const arcs = slices.map((slice) => {
    const pct = slice.value / total;
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;

    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const largeArc = pct > 0.5 ? 1 : 0;

    return {
      ...slice,
      pct,
      d: `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`,
    };
  });

  return (
    <svg viewBox="0 0 160 160" className="w-full max-w-[160px]" aria-hidden="true">
      {arcs.map((arc) => (
        <path
          key={arc.label}
          d={arc.d}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize="13" fontWeight="800">
        {slices[0] ? `${(slices[0].pct * 100).toFixed(0)}%` : ""}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#8d97ac" fontSize="9" fontWeight="600">
        {slices[0]?.label ?? ""}
      </text>
    </svg>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values, color = "var(--color-brand)" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 200;
  const h = 48;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" aria-hidden="true">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,${h} ${pts} ${w},${h}`}
        fill="url(#spark-fill)"
        stroke="none"
      />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Asset Row ────────────────────────────────────────────────────────────────

const ASSET_COLORS = ["#00FF9D", "#3B82F6", "#F59E0B", "#EC4899", "#8B5CF6", "#06B6D4"];

function AssetRow({
  code,
  balance,
  usdValue,
  usdDisplay,
  pct,
  color,
  issuer,
  network,
}: {
  code: string;
  balance: string;
  usdValue: number;
  usdDisplay?: string;
  pct: number;
  color: string;
  issuer?: string;
  network: string;
}) {
  const explorerBase =
    network === "PUBLIC"
      ? "https://stellar.expert/explorer/public"
      : "https://stellar.expert/explorer/testnet";

  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-black shrink-0"
        style={{ backgroundColor: color }}
      >
        {code.slice(0, 3)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-bold text-[13px]">{code}</span>
          {issuer && (
            <a
              href={`${explorerBase}/asset/${code}-${issuer}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${code} on Stellar Explorer`}
              className="text-muted hover:text-brand transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="w-full bg-border rounded-full h-1 mt-1.5">
          <div
            className="h-1 rounded-full transition-all duration-500"
            style={{ width: `${pct * 100}%`, backgroundColor: color }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-white font-bold text-[13px] font-mono">{balance}</p>
        <p className="text-muted text-[11px]">{usdDisplay ?? `$${usdValue.toFixed(2)}`}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WalletPortfolioPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { publicKey, status: walletStatus } = useAutoStellarWallet();
  const { network } = useNetworkOverride();
  const freighterNetwork = getFreighterNetwork(network);

  const { balance, isLoading, error, refresh } = useBalance({
    publicKey,
    network: freighterNetwork,
    refreshInterval: BALANCE_REFRESH_INTERVAL_MS,
  });

  // ── Real Horizon history ──────────────────────────────────────────────────
  const [history, setHistory] = useState<number[] | null>(null);
  useEffect(() => {
    if (!publicKey) { setHistory(null); return; }
    fetch(`/api/wallet/history?publicKey=${encodeURIComponent(publicKey)}&days=14&network=${network}`)
      .then((r) => r.json())
      .then((d) => setHistory(Array.isArray(d.history) && d.history.length > 0 ? d.history : null))
      .catch(() => setHistory(null));
  }, [publicKey, network]);

  // ── Real asset prices ─────────────────────────────────────────────────────
  const [assetPrices, setAssetPrices] = useState<Record<string, number>>({});
  const otherAssets: AssetBalance[] = balance?.otherAssets ?? [];
  useEffect(() => {
    if (otherAssets.length === 0) return;
    const codes = otherAssets.map((a) => a.code).join(",");
    fetch(`/api/prices/assets?codes=${codes}`)
      .then((r) => r.json())
      .then((d) => setAssetPrices(d.prices ?? {}))
      .catch(() => {/* keep previous */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherAssets.map((a) => a.code).join(",")]);

  const xlmUsd = balance?.usdRaw ?? 0;

  const getAssetUsd = (code: string, rawBalance: string): number | null => {
    const price = assetPrices[code.toUpperCase()];
    return typeof price === "number" ? parseFloat(rawBalance) * price : null;
  };

  // Build donut slices: XLM + other assets by USD value
  const donutSlices: DonutSlice[] = useMemo(() => {
    const slices: DonutSlice[] = [
      { label: "XLM", value: xlmUsd, color: ASSET_COLORS[0] },
      ...otherAssets
        .map((a, i) => {
          const usd = getAssetUsd(a.code, a.balance);
          return usd !== null ? { label: a.code, value: usd, color: ASSET_COLORS[(i + 1) % ASSET_COLORS.length] } : null;
        })
        .filter((s): s is DonutSlice => s !== null),
    ].filter((s) => s.value > 0);
    return slices.length ? slices : [{ label: "XLM", value: 1, color: ASSET_COLORS[0] }];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xlmUsd, otherAssets, assetPrices]);

  const totalUsd = donutSlices.reduce((s, d) => s + d.value, 0);

  const handleCopy = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const isUp = history !== null && history.length >= 2 && history[history.length - 1] >= history[0];

  return (
    <div className="flex min-h-screen bg-background text-white font-sans overflow-hidden">
      {/* Glows */}
      <div className="glow-large fixed top-0 left-0 w-[50vw] h-[50vw] rounded-full bg-brand/5 blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
      <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.03] rounded-full blur-[100px] pointer-events-none translate-x-1/3" />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide relative z-10">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <div className="dashboard-main space-y-8 max-w-[1400px] mx-auto w-full">
          {/* Page title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[28px] font-extrabold text-white tracking-tight">Wallet Portfolio</h1>
              <p className="text-muted text-[13px] mt-1">
                {network === "mainnet" ? "Mainnet" : "Testnet"} · Stellar Network
              </p>
            </div>
            <button
              onClick={refresh}
              disabled={isLoading}
              aria-label="Refresh portfolio"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-muted hover:text-white hover:border-brand/30 text-[13px] font-medium transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Error */}
          {error && (
            <div role="alert" className="flex items-start gap-2 bg-error/10 border border-error/30 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
              <p className="text-error text-[13px]">{error.message}</p>
            </div>
          )}

          {/* No wallet */}
          {!publicKey && walletStatus !== "loading" && (
            <div className="bg-surface border border-border rounded-[24px] p-12 text-center">
              <Wallet className="w-10 h-10 text-muted mx-auto mb-4" />
              <p className="text-white font-bold text-[16px] mb-2">No wallet connected</p>
              <p className="text-muted text-[13px]">Connect your Stellar wallet to view your portfolio.</p>
            </div>
          )}

          {(publicKey || walletStatus === "loading") && (
            <>
              {/* Top row: Balance hero + Donut */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Balance hero */}
                <div className="lg:col-span-2 bg-surface border border-border rounded-[24px] p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted text-[11px] font-semibold uppercase tracking-wider">Total Portfolio Value</span>
                    {history !== null && (
                      <span
                        className={`flex items-center gap-1 text-[12px] font-bold ${isUp ? "text-brand" : "text-error"}`}
                      >
                        {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        14d trend
                      </span>
                    )}
                  </div>

                  {isLoading && !balance ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-brand animate-spin" />
                      <span className="text-muted text-[13px]">Loading balance…</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-3">
                        <span className="text-[42px] font-black text-white leading-none font-mono">
                          {balance?.xlm ?? "—"}
                        </span>
                        <span className="text-muted text-[18px] font-bold">XLM</span>
                      </div>
                      <p className="text-muted text-[15px]">≈ ${totalUsd.toFixed(2)} USD</p>
                    </>
                  )}

                  {/* Sparkline — only shown when real history is available */}
                  {history !== null && history.length > 1 && (
                    <div className="mt-2">
                      <Sparkline values={history} color={isUp ? "var(--color-brand, #00FF9D)" : "#EF4444"} />
                      <p className="text-muted text-[10px] mt-1">14-day balance history</p>
                    </div>
                  )}

                  {/* Address */}
                  {publicKey && (
                    <div className="flex items-center gap-2 mt-2 pt-4 border-t border-border">
                      <span className="text-muted text-[11px] font-mono truncate flex-1">
                        {publicKey.slice(0, 12)}…{publicKey.slice(-8)}
                      </span>
                      <button
                        onClick={handleCopy}
                        aria-label="Copy wallet address"
                        className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer text-muted hover:text-white"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-brand" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <a
                        href={`https://stellar.expert/explorer/${network === "mainnet" ? "public" : "testnet"}/account/${publicKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View on Stellar Explorer"
                        className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors text-muted hover:text-brand"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Donut + legend */}
                <div className="bg-surface border border-border rounded-[24px] p-6 flex flex-col items-center gap-4">
                  <span className="text-muted text-[11px] font-semibold uppercase tracking-wider self-start">
                    Asset Allocation
                  </span>
                  <DonutChart slices={donutSlices} />
                  <div className="w-full space-y-2">
                    {donutSlices.map((s) => (
                      <div key={s.label} className="flex items-center justify-between text-[12px]">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="text-muted font-medium">{s.label}</span>
                        </div>
                        <span className="text-white font-bold">
                          {((s.value / totalUsd) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Asset list */}
              <div className="bg-surface border border-border rounded-[24px] p-6">
                <h2 className="text-[15px] font-extrabold text-white uppercase tracking-wider mb-4">
                  Holdings
                </h2>

                {isLoading && !balance ? (
                  <div className="flex items-center gap-3 py-4">
                    <Loader2 className="w-4 h-4 text-brand animate-spin" />
                    <span className="text-muted text-[13px]">Loading assets…</span>
                  </div>
                ) : (
                  <>
                    {/* XLM row */}
                    <AssetRow
                      code="XLM"
                      balance={`${balance?.xlm ?? "—"} XLM`}
                      usdValue={xlmUsd}
                      pct={totalUsd > 0 ? xlmUsd / totalUsd : 1}
                      color={ASSET_COLORS[0]}
                      network={freighterNetwork}
                    />

                    {/* Other assets */}
                    {otherAssets.map((asset, i) => {
                      const usd = getAssetUsd(asset.code, asset.balance);
                      return (
                        <AssetRow
                          key={`${asset.code}-${asset.issuer}`}
                          code={asset.code}
                          balance={`${parseFloat(asset.balance).toFixed(2)} ${asset.code}`}
                          usdValue={usd ?? 0}
                          usdDisplay={usd !== null ? `$${usd.toFixed(2)}` : "—"}
                          pct={totalUsd > 0 && usd !== null ? usd / totalUsd : 0}
                          color={ASSET_COLORS[(i + 1) % ASSET_COLORS.length]}
                          issuer={asset.issuer}
                          network={freighterNetwork}
                        />
                      );
                    })}

                    {otherAssets.length === 0 && (
                      <p className="text-muted text-[13px] py-4 text-center">
                        No other assets found. Add trustlines to hold USDC, BTC, ETH and more.
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
