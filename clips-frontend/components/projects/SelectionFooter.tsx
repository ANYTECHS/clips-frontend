"use client";

import React, { useState } from "react";
import { 
  Send, 
  Trash2, 
  Download, 
  Zap, 
  MoveRight,
  Hexagon,
  Info
} from "lucide-react";
import { calculateMintCost, formatSol } from "@/app/lib/mintUtils";

interface SelectionFooterProps {
  count: number;
  onMint: () => void;
  isMinting?: boolean;
}

export default function SelectionFooter({ count, onMint, isMinting = false }: SelectionFooterProps) {
  if (count === 0) return null;

  const { gasFee, storageCost, totalCost } = calculateMintCost(count);

  return (
    <div className="w-full py-6 animate-in slide-in-from-bottom-5 fade-in duration-500 border-t border-white/5 bg-[#050505]/40 backdrop-blur-md">
      {/* Error Banner */}
      {postError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3 mb-4 mx-1">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-[13px] text-red-300 flex-1">{postError}</p>
          {retryCount >= 3 && (
            <span className="text-[11px] text-red-400/60 shrink-0">Try reconnecting your platform account.</span>
          )}
          <button
            onClick={() => setPostError(null)}
            className="text-red-400/60 hover:text-red-300 transition-colors shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="relative bg-[#0B100E] border border-white/10 rounded-[24px] sm:rounded-[32px] px-4 sm:px-8 py-4 flex flex-col items-stretch gap-4 w-full shadow-2xl overflow-hidden">
        {/* Top row: count + middle actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: Selection Count */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#00E58F] flex items-center justify-center text-black font-black text-[16px] shrink-0">
              {count}
            </div>
            <div className="space-y-0.5">
              <p className="text-[16px] font-extrabold text-white">Clips selected</p>
              <p className="text-[12px] font-medium text-[#5A6F65]">Ready for batch export or posting</p>
            </div>
          </div>

          {/* Middle: Actions */}
          <div className="flex flex-wrap items-center gap-3 text-[#5A6F65]">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-white/5 bg-white/[0.02] text-[13px] font-bold hover:text-white hover:border-white/10 transition-all touch-manipulation">
              <Download className="w-4 h-4 shrink-0" />
              <span>Export</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-white/5 bg-white/[0.02] text-[13px] font-bold hover:text-white hover:border-white/10 transition-all touch-manipulation">
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Right: Cost & Primary Actions */}
        <div className="flex flex-col items-end gap-3">
          {/* Cost breakdown */}
          <div className="flex items-center gap-3 md:gap-4 text-[12px] text-[#5A6F65] bg-black/40 border border-white/5 rounded-xl px-4 py-2">
            <div className="flex items-center gap-1.5" title="Estimated gas and rent fee">
              <span>Gas:</span>
              <span className="text-white/90 font-medium">{formatSol(gasFee)}</span>
            </div>
            <div className="w-[1px] h-3 bg-white/10" />
            <div className="flex items-center gap-1.5" title="Arweave storage fee">
              <span>Storage:</span>
              <span className="text-white/90 font-medium">{formatSol(storageCost)}</span>
            </div>
            <div className="w-[1px] h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-brand font-bold">Total:</span>
              <span className="text-[#00E58F] font-black">{formatSol(totalCost)}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-[#111815] border border-[#1A2621] text-brand font-black text-[12px] group hover:border-brand/40 transition-all">
              <Zap className="w-4 h-4 fill-brand" />
              <span>AUTO-SCHEDULE ON</span>
            </button>
            
            <button 
              onClick={onMint}
              disabled={isMinting || count === 0}
              className={`flex items-center gap-3 px-10 py-4 rounded-3xl text-black font-black text-[15px] transition-all ${
                isMinting 
                  ? "bg-[#00E58F]/50 cursor-not-allowed" 
                  : "bg-[#00E58F] hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_30px_rgba(0,229,143,0.2)]"
              }`}
            >
              {isMinting ? (
                <span>Minting...</span>
              ) : (
                <>
                  <span>Mint Selected Clips</span>
                  <Hexagon className="w-5 h-5 ml-1 fill-black/20" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
