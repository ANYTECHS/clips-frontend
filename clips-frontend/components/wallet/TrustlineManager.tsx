"use client";

import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Link,
} from "lucide-react";
import { useTrustline } from "@/app/hooks/useTrustline";
import type { AssetBalance } from "@/app/hooks/useBalance";
import { STELLAR_NETWORK } from "@/app/lib/networkConfig";

// ─── Well-known assets ────────────────────────────────────────────────────────

interface PresetAsset {
  code: string;
  issuer: string;
  label: string;
  description: string;
}

const PRESET_ASSETS: PresetAsset[] = [
  {
    code: "USDC",
    issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    label: "USDC",
    description: "USD Coin — Circle",
  },
  {
    code: "USDC",
    issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    label: "USDC (Testnet)",
    description: "USD Coin — Testnet issuer",
  },
  {
    code: "BTC",
    issuer: "GDPJALI4AZKUU2W426U5WKMAT6CN3AJRPIIRYR2YM54TL2GDWO5O2MZM",
    label: "BTC",
    description: "Wrapped Bitcoin on Stellar",
  },
  {
    code: "ETH",
    issuer: "GBDEVU63Y6NTHJQQZIKVTC23NWLQKRZRNFZRQNLKQKV7YKDYWBNZ45GK",
    label: "ETH",
    description: "Wrapped Ether on Stellar",
  },
  {
    code: "yXLM",
    issuer: "GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55",
    label: "yXLM",
    description: "Yield XLM — Ultra Capital",
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface TrustlineManagerProps {
  /** Stellar public key of the account */
  publicKey: string;
  /** Optional embedded wallet secret key. If omitted, Freighter is used. */
  secretKey?: string | null;
  /** Currently held non-native assets (from useBalance) */
  existingTrustlines?: AssetBalance[];
  /** Called after a trustline is successfully added or removed */
  onTrustlineChanged?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrustlineManager({
  publicKey,
  secretKey,
  existingTrustlines = [],
  onTrustlineChanged,
}: TrustlineManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [selectedPreset, setSelectedPreset] = useState<PresetAsset | null>(null);
  const [customCode, setCustomCode] = useState("");
  const [customIssuer, setCustomIssuer] = useState("");
  const [customLimit, setCustomLimit] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { status, isLoading, error, changeTrustline, reset } = useTrustline({
    onSuccess: (result) => {
      const verb = result.action === "add" ? "added" : "removed";
      setSuccessMsg(`${result.assetCode} trustline ${verb} successfully.`);
      setSelectedPreset(null);
      setCustomCode("");
      setCustomIssuer("");
      setCustomLimit("");
      onTrustlineChanged?.();
      setTimeout(() => setSuccessMsg(null), 5000);
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  const hasTrustline = (code: string, issuer: string) =>
    existingTrustlines.some(
      (a) => a.code === code && a.issuer === issuer
    );

  const explorerBase =
    STELLAR_NETWORK === "mainnet"
      ? "https://stellar.expert/explorer/public"
      : "https://stellar.expert/explorer/testnet";

  const handleAddPreset = async () => {
    if (!selectedPreset) return;
    reset();
    await changeTrustline({
      publicKey,
      assetCode: selectedPreset.code,
      assetIssuer: selectedPreset.issuer,
      action: "add",
      secretKey: secretKey ?? undefined,
    });
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCode.trim() || !customIssuer.trim()) return;
    reset();
    await changeTrustline({
      publicKey,
      assetCode: customCode.trim().toUpperCase(),
      assetIssuer: customIssuer.trim(),
      action: "add",
      secretKey: secretKey ?? undefined,
      limit: customLimit.trim() || undefined,
    });
  };

  const handleRemove = async (code: string, issuer: string) => {
    reset();
    await changeTrustline({
      publicKey,
      assetCode: code,
      assetIssuer: issuer,
      action: "remove",
      secretKey: secretKey ?? undefined,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mt-4 pt-4 border-t border-border">
      {/* Section header / toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full text-left group"
        aria-expanded={expanded}
        aria-controls="trustline-panel"
      >
        <div className="flex items-center gap-2">
          <Link className="w-4 h-4 text-brand" aria-hidden="true" />
          <span className="text-[13px] font-bold text-white">Asset Trustlines</span>
          {existingTrustlines.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] font-bold">
              {existingTrustlines.length}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted group-hover:text-white transition-colors" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted group-hover:text-white transition-colors" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div id="trustline-panel" className="mt-4 space-y-4">

          {/* Existing trustlines */}
          {existingTrustlines.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted font-medium uppercase tracking-wider">Active Trustlines</p>
              {existingTrustlines.map((asset) => (
                <div
                  key={`${asset.code}-${asset.issuer}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-hover border border-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-bold text-white shrink-0">{asset.code}</span>
                    <a
                      href={`${explorerBase}/asset/${asset.code}-${asset.issuer}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-muted hover:text-brand transition-colors truncate flex items-center gap-1"
                      aria-label={`View ${asset.code} on Stellar Explorer`}
                    >
                      {asset.issuer.slice(0, 8)}…{asset.issuer.slice(-4)}
                      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                    </a>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[13px] font-bold text-white">
                      {parseFloat(asset.balance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </span>
                    <button
                      onClick={() => handleRemove(asset.code, asset.issuer)}
                      disabled={isLoading}
                      aria-label={`Remove ${asset.code} trustline`}
                      className="p-1.5 rounded-lg hover:bg-error/10 hover:text-error text-muted transition-colors disabled:opacity-40"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Success message */}
          {successMsg && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-brand/10 border border-brand/20"
            >
              <CheckCircle className="w-4 h-4 text-brand shrink-0" aria-hidden="true" />
              <p className="text-brand text-[12px] font-medium">{successMsg}</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-error/10 border border-error/30"
            >
              <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-error text-[12px] leading-relaxed">{error.message}</p>
            </div>
          )}

          {/* Add trustline section */}
          <div className="space-y-3">
            <p className="text-[11px] text-muted font-medium uppercase tracking-wider">Add Trustline</p>

            {/* Mode tabs */}
            <div className="flex gap-1 p-1 bg-surface-hover rounded-xl border border-border">
              <button
                onClick={() => setMode("preset")}
                className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
                  mode === "preset"
                    ? "bg-brand/10 text-brand border border-brand/20"
                    : "text-muted hover:text-white"
                }`}
              >
                Common Assets
              </button>
              <button
                onClick={() => setMode("custom")}
                className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold transition-colors ${
                  mode === "custom"
                    ? "bg-brand/10 text-brand border border-brand/20"
                    : "text-muted hover:text-white"
                }`}
              >
                Custom Asset
              </button>
            </div>

            {/* Preset picker */}
            {mode === "preset" && (
              <div className="space-y-2">
                {PRESET_ASSETS.map((asset) => {
                  const alreadyTrusted = hasTrustline(asset.code, asset.issuer);
                  const isSelected =
                    selectedPreset?.code === asset.code &&
                    selectedPreset?.issuer === asset.issuer;

                  return (
                    <button
                      key={`${asset.code}-${asset.issuer}`}
                      onClick={() =>
                        setSelectedPreset(isSelected ? null : asset)
                      }
                      disabled={alreadyTrusted || isLoading}
                      aria-pressed={isSelected}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        alreadyTrusted
                          ? "border-brand/20 bg-brand/5 cursor-default"
                          : isSelected
                          ? "border-brand/40 bg-brand/10"
                          : "border-border bg-surface-hover hover:border-brand/30"
                      }`}
                    >
                      <div>
                        <p className="text-[13px] font-bold text-white">{asset.label}</p>
                        <p className="text-[11px] text-muted">{asset.description}</p>
                      </div>
                      {alreadyTrusted ? (
                        <span className="text-[10px] font-bold text-brand px-2 py-0.5 rounded-full bg-brand/10 border border-brand/20 shrink-0">
                          Active
                        </span>
                      ) : (
                        <div
                          className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                            isSelected ? "border-brand bg-brand" : "border-border"
                          }`}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}

                <button
                  onClick={handleAddPreset}
                  disabled={!selectedPreset || isLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-black font-bold text-[13px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      {status === "building" ? "Building…" : "Submitting…"}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      Add Trustline
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Custom asset form */}
            {mode === "custom" && (
              <form onSubmit={handleAddCustom} className="space-y-3" aria-label="Add custom asset trustline">
                <div>
                  <label className="block text-[11px] text-muted font-medium mb-1" htmlFor="trustline-code">
                    Asset Code
                  </label>
                  <input
                    id="trustline-code"
                    type="text"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    placeholder="e.g. USDC"
                    maxLength={12}
                    required
                    className="w-full bg-surface-hover border border-border rounded-xl px-3 py-2 text-[13px] text-white placeholder:text-muted focus:outline-none focus:border-brand/50 transition-colors uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted font-medium mb-1" htmlFor="trustline-issuer">
                    Issuer Address
                  </label>
                  <input
                    id="trustline-issuer"
                    type="text"
                    value={customIssuer}
                    onChange={(e) => setCustomIssuer(e.target.value)}
                    placeholder="G… (56 characters)"
                    required
                    className="w-full bg-surface-hover border border-border rounded-xl px-3 py-2 text-[13px] text-white placeholder:text-muted focus:outline-none focus:border-brand/50 transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted font-medium mb-1" htmlFor="trustline-limit">
                    Trust Limit <span className="text-muted/60">(optional — leave blank for max)</span>
                  </label>
                  <input
                    id="trustline-limit"
                    type="number"
                    value={customLimit}
                    onChange={(e) => setCustomLimit(e.target.value)}
                    placeholder="e.g. 10000"
                    min="0"
                    step="any"
                    className="w-full bg-surface-hover border border-border rounded-xl px-3 py-2 text-[13px] text-white placeholder:text-muted focus:outline-none focus:border-brand/50 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !customCode.trim() || !customIssuer.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-black font-bold text-[13px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      {status === "building" ? "Building…" : "Submitting…"}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      Add Custom Trustline
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
