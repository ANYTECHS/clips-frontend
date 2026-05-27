"use client";

import React from "react";
import { AlertCircle, Hexagon, X } from "lucide-react";
import { formatSol } from "@/app/lib/mintUtils";

/**
 * MintConfirmationModal - Shows estimated transaction fees before minting
 * 
 * Displays:
 * - Number of clips to mint
 * - Gas fee breakdown
 * - Storage cost breakdown
 * - Total estimated cost
 * - Warning about estimated nature of fees
 * - Confirm/Cancel buttons
 */

interface MintConfirmationModalProps {
  clipCount: number;
  gasFee: number;
  storageCost: number;
  totalCost: number;
  isMinting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function MintConfirmationModal({
  clipCount,
  gasFee,
  storageCost,
  totalCost,
  isMinting,
  onConfirm,
  onCancel,
}: MintConfirmationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* Modal Container */}
      <div className="w-full max-w-[500px] mx-4 bg-surface/95 backdrop-blur-md border border-white/10 rounded-[24px] p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-[24px] font-bold text-white tracking-tight">
              Confirm Mint
            </h2>
            <p className="text-[14px] text-muted-foreground mt-1">
              Review the estimated transaction fees
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isMinting}
            className="p-2 text-muted-foreground hover:text-white transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clip Count */}
        <div className="mb-6 p-4 bg-brand/10 border border-brand/20 rounded-[16px]">
          <p className="text-[13px] text-muted-foreground mb-1">Clips to mint</p>
          <p className="text-[28px] font-black text-brand">{clipCount}</p>
        </div>

        {/* Fee Breakdown */}
        <div className="space-y-3 mb-6">
          <h3 className="text-[13px] font-bold text-white/60 uppercase tracking-wider">
            Estimated Fees
          </h3>

          {/* Gas Fee */}
          <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-[12px]">
            <div>
              <p className="text-[13px] text-muted-foreground">Gas Fee</p>
              <p className="text-[11px] text-white/50 mt-0.5">
                Solana network + Metaplex rent
              </p>
            </div>
            <p className="text-[14px] font-bold text-white">
              {formatSol(gasFee)}
            </p>
          </div>

          {/* Storage Cost */}
          <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-[12px]">
            <div>
              <p className="text-[13px] text-muted-foreground">Storage Cost</p>
              <p className="text-[11px] text-white/50 mt-0.5">
                Arweave permanent storage
              </p>
            </div>
            <p className="text-[14px] font-bold text-white">
              {formatSol(storageCost)}
            </p>
          </div>

          {/* Total Cost */}
          <div className="flex items-center justify-between p-4 bg-brand/10 border border-brand/30 rounded-[12px] mt-4">
            <p className="text-[14px] font-bold text-white">Total Estimated Cost</p>
            <p className="text-[18px] font-black text-brand">
              {formatSol(totalCost)}
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="mb-6 flex gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-[12px]">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-bold text-yellow-300 mb-1">
              Estimated Fees
            </p>
            <p className="text-[12px] text-yellow-200/80">
              These are estimated fees. Actual fees may vary based on network conditions. You'll be prompted to approve the transaction in your wallet.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isMinting}
            className="flex-1 px-6 py-3 rounded-[12px] border border-white/10 text-white font-bold text-[14px] hover:bg-white/[0.05] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isMinting}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-[12px] font-bold text-[14px] transition-all ${
              isMinting
                ? "bg-brand/50 text-black cursor-not-allowed"
                : "bg-brand text-black hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_30px_rgba(0,229,143,0.2)]"
            }`}
          >
            {isMinting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Minting...
              </>
            ) : (
              <>
                <span>Confirm & Mint</span>
                <Hexagon className="w-4 h-4 fill-black/20" />
              </>
            )}
          </button>
        </div>

        {/* Footer Info */}
        <p className="text-[11px] text-white/40 text-center mt-4">
          You'll need to approve this transaction in your wallet
        </p>
      </div>
    </div>
  );
}
