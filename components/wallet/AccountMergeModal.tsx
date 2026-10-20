"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Copy, Loader2, ShieldAlert, X } from "lucide-react";
import { StrKey } from "@stellar/stellar-sdk";
import { buildBatchTransaction, getStellarServer } from "@/app/lib/stellar";
import { createAccountMergeOp } from "@/app/lib/stellarOperations";
import { useWalletSelector } from "@/components/wallet/WalletProvider";
import { useMultiWallet } from "@/components/wallet/MultiWalletProvider";
import { useToast } from "@/hooks/useToast";

export interface AccountMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceAddress?: string;
  onSuccess?: (txHash: string) => void;
}

export default function AccountMergeModal({
  isOpen,
  onClose,
  sourceAddress: propSourceAddress,
  onSuccess,
}: AccountMergeModalProps) {
  const { address: walletAddress } = useWalletSelector((s) => ({ address: s.address }));
  const sourceAddress = propSourceAddress || walletAddress || "";
  const { wallets, removeWallet } = useMultiWallet();
  const { showToast } = useToast();

  const [destinationAddress, setDestinationAddress] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successHash, setSuccessHash] = useState<string | null>(null);

  const [nonNativeAssetsCount, setNonNativeAssetsCount] = useState<number | null>(null);
  const [nativeBalance, setNativeBalance] = useState<string | null>(null);

  // Load account subentries & balances to warn if open trustlines/offers exist
  useEffect(() => {
    if (!isOpen || !sourceAddress || !StrKey.isValidEd25519PublicKey(sourceAddress)) {
      return;
    }

    let isMounted = true;
    setIsValidating(true);
    setError(null);

    const checkAccount = async () => {
      try {
        const server = getStellarServer();
        const acc = await server.loadAccount(sourceAddress);
        if (!isMounted) return;

        const nonNative = acc.balances.filter((b) => b.asset_type !== "native");
        const native = acc.balances.find((b) => b.asset_type === "native");
        setNonNativeAssetsCount(nonNative.length);
        setNativeBalance(native?.balance || "0");
      } catch (err: any) {
        if (!isMounted) return;
        // Account may not exist or network unreachable
        if (err?.response?.status === 404) {
          setError("Source account not found on ledger.");
        } else {
          setNativeBalance("0");
        }
      } finally {
        if (isMounted) setIsValidating(false);
      }
    };

    checkAccount();

    return () => {
      isMounted = false;
    };
  }, [isOpen, sourceAddress]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const isDestinationValid =
    Boolean(destinationAddress.trim()) &&
    StrKey.isValidEd25519PublicKey(destinationAddress.trim()) &&
    destinationAddress.trim() !== sourceAddress;

  const isConfirmed = confirmInput.trim() === "CONFIRM MERGE" || confirmInput.trim() === destinationAddress.trim();

  const canSubmit = isDestinationValid && isConfirmed && !isSubmitting && !isValidating;

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (nonNativeAssetsCount && nonNativeAssetsCount > 0) {
      setError(
        "Account has active trustlines or assets. All non-native tokens must be transferred and trustlines removed (limit 0) before merging."
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const trimmedDest = destinationAddress.trim();
      const mergeOp = createAccountMergeOp({
        destination: trimmedDest,
        source: sourceAddress,
      });

      const batch = await buildBatchTransaction(sourceAddress, [mergeOp], {
        memo: "Account Merge",
      });

      if (!batch.ok) {
        throw new Error(batch.error.message);
      }

      // Record audit event
      try {
        console.info(`[Audit Trail] Account merge initiated: source=${sourceAddress} destination=${trimmedDest}`);
      } catch {}

      // Remove from multi-wallet storage if tracked
      const matchedWallet = wallets.find((w) => w.publicKey === sourceAddress);
      if (matchedWallet) {
        removeWallet(matchedWallet.id);
      }

      setSuccessHash(batch.hash || "merged");
      showToast("Account successfully merged into destination!", "success");
      onSuccess?.(batch.hash || "");
    } catch (err: any) {
      const message = err?.message || "Failed to merge account. Please verify destination and try again.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative bg-zinc-950 border border-red-500/30 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col p-6 space-y-5 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 id="merge-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
                Merge Stellar Account
                <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
                  Danger Zone
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Consolidate balances & permanently close account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Close merge dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successHash ? (
          <div className="space-y-4 py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">Merge Transaction Successful</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              All native XLM have been transferred to destination, and the source account has been closed.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleMerge} className="space-y-4">
            {/* Warning Banner */}
            <div className="rounded-xl bg-red-950/40 border border-red-500/30 p-3.5 flex gap-3 text-red-200">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed space-y-1">
                <p className="font-semibold text-red-300">Irreversible Action</p>
                <p>
                  This will transfer all XLM to the destination and permanently close this account. This cannot be undone.
                </p>
              </div>
            </div>

            {/* Source Account Info */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3.5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Source Account</span>
                {nativeBalance !== null && (
                  <span className="text-emerald-400 font-mono font-medium">{nativeBalance} XLM</span>
                )}
              </div>
              <div className="font-mono text-xs text-zinc-300 break-all bg-black/40 p-2 rounded border border-zinc-800/80">
                {sourceAddress || "No source address selected"}
              </div>
              {nonNativeAssetsCount !== null && nonNativeAssetsCount > 0 && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5 pt-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Account has {nonNativeAssetsCount} non-native trustline(s). Remove them first.
                </p>
              )}
            </div>

            {/* Destination Public Key */}
            <div className="space-y-1.5">
              <label htmlFor="destination-address" className="block text-xs font-medium text-zinc-300">
                Destination Public Key (G...)
              </label>
              <input
                id="destination-address"
                type="text"
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                placeholder="G..."
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors font-mono"
                disabled={isSubmitting}
                required
              />
              {destinationAddress.trim() && !StrKey.isValidEd25519PublicKey(destinationAddress.trim()) && (
                <p className="text-xs text-red-400">Please enter a valid Stellar Ed25519 public key.</p>
              )}
              {destinationAddress.trim() === sourceAddress && (
                <p className="text-xs text-red-400">Destination address cannot be identical to source address.</p>
              )}
            </div>

            {/* Confirmation Input */}
            <div className="space-y-1.5">
              <label htmlFor="confirm-merge" className="block text-xs font-medium text-zinc-300">
                Type <span className="text-red-400 font-bold select-all">CONFIRM MERGE</span> to proceed
              </label>
              <input
                id="confirm-merge"
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="CONFIRM MERGE"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
                disabled={isSubmitting}
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-red-300 text-xs">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Merging Account...
                  </>
                ) : (
                  <>
                    Merge & Close Account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
