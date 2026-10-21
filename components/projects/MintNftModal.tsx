"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Coins, Loader2, RotateCcw, X } from "lucide-react";

import { useStellarTransaction } from "@/app/hooks/useStellarTransaction";
import {
  buildClipNftMetadata,
  DEFAULT_ROYALTY_PERCENT,
  formatXlm,
  MAX_ROYALTY_PERCENT,
  type MintableClip,
  type MintCostEstimate,
} from "@/app/lib/mintUtils";
import { sanitize } from "@/app/lib/sanitize";
import LazyImage from "@/components/common/LazyImage";

// ─── API helpers ──────────────────────────────────────────────────────────────

interface MintDraft {
  title: string;
  description: string;
  royaltyPercent: number;
}

async function readApiResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) {
    throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`);
  }
  return body.data as T;
}

/** Ask the server to build (and simulate) the contract `mint` transaction. */
async function requestMintBuild(
  clipId: string,
  publicKey: string,
  draft: MintDraft
): Promise<{ xdr: string; estimate: MintCostEstimate }> {
  const res = await fetch(`/api/clips/${encodeURIComponent(clipId)}/mint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey, ...draft }),
  });
  return readApiResponse(res);
}

/** Record a submitted mint so the clip is marked minted with its token id. */
async function recordMint(
  clipId: string,
  publicKey: string,
  txHash: string
): Promise<{ tokenId: string }> {
  const res = await fetch(`/api/clips/${encodeURIComponent(clipId)}/mint`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey, txHash }),
  });
  return readApiResponse(res);
}

// ─── Component ────────────────────────────────────────────────────────────────

type MintPhase = "loading" | "preview" | "minting" | "recording" | "success" | "error";

const TX_STATUS_LABELS: Record<string, string> = {
  building: "Preparing transaction…",
  signing: "Approve in your wallet…",
  sponsoring: "Requesting fee sponsorship…",
  submitting: "Submitting to Stellar…",
};

export interface MintNftModalProps {
  clip: MintableClip;
  onClose: () => void;
  /** Called once the mint is confirmed and recorded. */
  onMinted: (clipId: string, tokenId: string) => void;
}

/**
 * Preview, cost estimate and confirmation for minting a clip as an NFT on
 * the Soroban NFT contract.
 */
export function MintNftModal({ clip, onClose, onMinted }: MintNftModalProps) {
  const initial = buildClipNftMetadata(clip);
  const [draft, setDraft] = useState<MintDraft>({
    title: initial.title,
    description: initial.description,
    royaltyPercent: DEFAULT_ROYALTY_PERCENT,
  });
  const [phase, setPhase] = useState<MintPhase>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<MintCostEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Hash of a mint that landed on-chain but has not been recorded yet. */
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);

  // Stable callback: the hook's helpers are memoised on it, and loadEstimate depends on them
  const handleTxError = useCallback((err: { message: string }) => setError(err.message), []);
  const { executeTransaction, getPublicKey, checkFreighterInstalled, status: txStatus, feeSponsored } =
    useStellarTransaction({ onError: handleTxError });

  const busy = phase === "loading" || phase === "minting" || phase === "recording";

  /** Connect the wallet and estimate the mint cost. */
  const loadEstimate = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      if (!checkFreighterInstalled()) {
        throw new Error("Freighter wallet is not installed. Install it to mint NFTs.");
      }
      const key = await getPublicKey();
      setPublicKey(key);
      const built = await requestMintBuild(clip.id, key, draft);
      setEstimate(built.estimate);
      setPhase("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : (err as { message?: string })?.message ?? "Failed to estimate mint cost");
      setPhase("error");
    }
    // Estimate once per open; the metadata draft does not change the fee materially.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id, checkFreighterInstalled, getPublicKey]);

  useEffect(() => {
    void loadEstimate();
  }, [loadEstimate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, busy]);

  /** Sign + submit the mint, then record it. Retrying after an on-chain success only re-records. */
  const handleConfirm = async () => {
    if (!publicKey) return loadEstimate();
    setError(null);

    let txHash = pendingTxHash;
    if (!txHash) {
      setPhase("minting");
      const result = await executeTransaction(
        async () => (await requestMintBuild(clip.id, publicKey, draft)).xdr
      );
      if (!result) {
        setPhase("error");
        return;
      }
      txHash = result.hash;
      setPendingTxHash(txHash);
    }

    setPhase("recording");
    try {
      const recorded = await recordMint(clip.id, publicKey, txHash);
      setTokenId(recorded.tokenId);
      setPendingTxHash(null);
      setPhase("success");
      onMinted(clip.id, recorded.tokenId);
    } catch (err) {
      setError(
        `Your NFT was minted but could not be saved yet: ${err instanceof Error ? err.message : "unknown error"}`
      );
      setPhase("error");
    }
  };

  const statusLabel =
    phase === "recording" ? "Confirming mint…" : TX_STATUS_LABELS[txStatus] ?? "Minting…";
  const canEdit = phase === "preview" || (phase === "error" && !pendingTxHash && estimate !== null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative bg-[#111] rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mint-nft-title"
      >
        <button
          onClick={onClose}
          disabled={busy}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors disabled:opacity-50"
          aria-label="Close mint dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Thumbnail */}
        <div className="relative w-full md:w-[240px] aspect-[9/16] md:aspect-auto bg-black shrink-0">
          <LazyImage
            src={clip.thumbnail}
            alt={sanitize(clip.title)}
            fill
            className="object-cover"
            sizes="240px"
          />
        </div>

        <div className="flex-1 p-6 space-y-5">
          <h2 id="mint-nft-title" className="text-xl font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-brand" /> Mint as NFT
          </h2>

          {phase === "success" ? (
            <div className="space-y-4" role="status">
              <div className="flex items-start gap-3 bg-brand/10 border border-brand/30 rounded-xl p-4">
                <CheckCircle2 className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-white font-bold">Clip minted!</p>
                  <p className="text-muted-foreground">
                    Token ID <span className="font-mono text-white">{sanitize(tokenId ?? "")}</span>
                    {feeSponsored && " · network fee sponsored by ClipCash"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-brand text-black font-bold hover:bg-brand-hover transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Metadata preview */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Title
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    maxLength={100}
                    disabled={!canEdit}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm normal-case disabled:opacity-60"
                  />
                </label>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Description
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    maxLength={500}
                    rows={3}
                    disabled={!canEdit}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm normal-case resize-none disabled:opacity-60"
                  />
                </label>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Royalty: <span className="text-white">{draft.royaltyPercent}%</span>
                  <input
                    type="range"
                    min={0}
                    max={MAX_ROYALTY_PERCENT}
                    step={0.5}
                    value={draft.royaltyPercent}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, royaltyPercent: Number(e.target.value) }))
                    }
                    disabled={!canEdit}
                    className="mt-2 w-full accent-brand"
                  />
                </label>
              </div>

              {/* Cost estimate */}
              <div className="bg-white/5 rounded-xl p-4 text-sm space-y-1.5" aria-live="polite">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Estimated cost
                </p>
                {estimate ? (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Network fee</span>
                      <span className="font-mono">{formatXlm(estimate.networkFeeXlm)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Contract fee</span>
                      <span className="font-mono">{formatXlm(estimate.contractFeeXlm)}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold pt-1.5 border-t border-white/10">
                      <span>Total</span>
                      <span className="font-mono">{formatXlm(estimate.totalXlm)}</span>
                    </div>
                  </>
                ) : phase === "loading" ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Estimating…
                  </p>
                ) : (
                  <p className="text-muted-foreground">Unavailable</p>
                )}
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2 bg-error/10 border border-error/30 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                  <p className="text-error text-[13px]">{sanitize(error)}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                {phase === "error" ? (
                  <button
                    onClick={() => (estimate || pendingTxHash ? handleConfirm() : loadEstimate())}
                    className="flex-1 py-2.5 rounded-xl bg-brand text-black font-bold hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" /> Retry
                  </button>
                ) : (
                  <button
                    onClick={handleConfirm}
                    disabled={busy || !estimate || !draft.title.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-brand text-black font-bold hover:bg-brand-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {(phase === "minting" || phase === "recording") && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {phase === "minting" || phase === "recording" ? statusLabel : "Confirm Mint"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
