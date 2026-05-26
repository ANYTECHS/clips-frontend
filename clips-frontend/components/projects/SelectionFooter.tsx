"use client";

import React, { useState } from "react";
import { 
  Send, 
  Trash2, 
  Download, 
  Zap, 
  MoveRight,
  Hexagon,
  Info,
  AlertCircle,
  X,
  Undo2,
  Redo2
} from "lucide-react";
import { calculateMintCost, formatSol } from "@/app/lib/mintUtils";

interface SelectionFooterProps {
  count: number;
  selectedIds?: string[];
  onMint: () => void;
  isMinting?: boolean;
  undo?: () => void;
  redo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export default function SelectionFooter({ 
  count, 
  selectedIds,
  onMint, 
  isMinting = false,
  undo,
  redo,
  canUndo = false,
  canRedo = false
}: SelectionFooterProps) {
  const [postError, setPostError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  if (count === 0) return null;

  const { gasFee, storageCost, totalCost } = calculateMintCost(count);

  return (
    <div className="w-full py-6 animate-in slide-in-from-bottom-5 fade-in duration-500 border-t border-white/5 bg-black/40 backdrop-blur-md">
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

      <div className="relative bg-input border border-white/10 rounded-[24px] sm:rounded-[32px] px-4 sm:px-8 py-4 flex flex-col items-stretch gap-4 w-full shadow-2xl overflow-hidden">
        {/* Top row: count + middle actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: Selection Count */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-black font-black text-[16px] shrink-0">
              {count}
            </div>
            <div className="space-y-0.5">
              <p className="text-[16px] font-extrabold text-white">Clips selected</p>
              <p className="text-[12px] font-medium text-muted-foreground">Ready for batch export or posting</p>
            </div>
          </div>

          {/* Middle: Actions */}
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-white/5 bg-white/[0.02] text-[13px] font-bold hover:text-white hover:border-white/10 transition-all touch-manipulation">
              <Download className="w-4 h-4 shrink-0" />
              <span>Export</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-white/5 bg-white/[0.02] text-[13px] font-bold hover:text-white hover:border-white/10 transition-all touch-manipulation">
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Delete</span>
            </button>
            <div className="w-[1px] h-4 bg-white/10 mx-1 hidden sm:block" />
            <button 
              onClick={undo}
              disabled={!canUndo}
              className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] text-muted-foreground hover:text-white hover:border-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo (Ctrl+Z)"
              aria-label="Undo selection"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button 
              onClick={redo}
              disabled={!canRedo}
              className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] text-muted-foreground hover:text-white hover:border-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo selection"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Cost & Primary Actions */}
        <div className="flex flex-col items-end gap-3">
          {/* Cost breakdown */}
          <div className="flex items-center gap-3 md:gap-4 text-[12px] text-muted-foreground bg-black/40 border border-white/5 rounded-xl px-4 py-2">
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
              <span className="text-brand font-black">{formatSol(totalCost)}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-surface border border-border text-brand font-black text-[12px] group hover:border-brand/40 transition-all">
              <Zap className="w-4 h-4 fill-brand" />
              <span>AUTO-SCHEDULE ON</span>
            </button>
            
            <button 
              onClick={onMint}
              disabled={isMinting || count === 0}
              className={`flex items-center gap-3 px-10 py-4 rounded-3xl text-black font-black text-[15px] transition-all ${
                isMinting 
                  ? "bg-brand/50 cursor-not-allowed" 
                  : "bg-brand hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_30px_rgba(0,229,143,0.2)]"
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
