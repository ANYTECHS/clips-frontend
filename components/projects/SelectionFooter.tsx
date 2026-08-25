"use client";

import React, { useState } from "react";
import { Archive, Download, Share2, Sparkles, Trash2, Undo2, Redo2 } from "lucide-react";

export interface SelectionFooterProps {
  count: number;
  selectedIds: string[];
  onMint: () => void;
  isMinting: boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onPost?: (selectedIds: string[], platforms: string[]) => void;
  isPosting?: boolean;
  postError?: string | null;
  onDelete?: (selectedIds: string[]) => void;
  isDeleting?: boolean;
  deleteError?: string | null;
  onArchive?: (selectedIds: string[]) => void;
  isArchiving?: boolean;
  archiveError?: string | null;
}

const PLATFORMS = ["youtube", "instagram", "tiktok", "twitter"];

export default function SelectionFooter({
  count,
  selectedIds,
  onMint,
  isMinting,
  undo,
  redo,
  canUndo,
  canRedo,
  onPost,
  isPosting,
  postError,
  onDelete,
  isDeleting,
  deleteError,
  onArchive,
  isArchiving,
  archiveError,
}: SelectionFooterProps) {
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handlePostConfirm = () => {
    if (onPost && selectedPlatforms.length > 0) {
      onPost(selectedIds, selectedPlatforms);
      setShowPlatformPicker(false);
    }
  };

  const handleDeleteConfirm = () => {
    onDelete?.(selectedIds);
    setShowDeleteConfirm(false);
  };

  const clipNoun = count === 1 ? "clip" : "clips";

  if (count === 0) return null;

  return (
    <div className="sticky bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[800px] w-full px-4 animate-in slide-in-from-bottom-8 fade-in duration-300">
      <div className="bg-background/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        
        {/* Left Side: Count & Undo/Redo */}
        <div className="flex items-center gap-4 pl-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand text-black font-bold text-xs">
              {count}
            </span>
            <span className="text-sm font-medium text-white/90">
              Selected
            </span>
          </div>

          <div className="h-6 w-px bg-white/10 hidden sm:block" />

          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              className={`p-2 rounded-lg transition-colors ${
                canUndo ? "hover:bg-white/10 text-white" : "text-white/30 cursor-not-allowed"
              }`}
              aria-label="Undo selection"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className={`p-2 rounded-lg transition-colors ${
                canRedo ? "hover:bg-white/10 text-white" : "text-white/30 cursor-not-allowed"
              }`}
              aria-label="Redo selection"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-2 pr-1 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          {onArchive && (
            <button
              onClick={() => onArchive(selectedIds)}
              disabled={isArchiving}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isArchiving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Archive className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {isArchiving ? "Archiving..." : "Archive"}
              </span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium text-error hover:bg-error/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDeleting ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {isDeleting ? "Deleting..." : "Delete"}
              </span>
            </button>
          )}
          <button
            onClick={() => setShowPlatformPicker(true)}
            disabled={isPosting}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isPosting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Share2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isPosting ? "Posting..." : "Post"}</span>
          </button>
          <button
            onClick={onMint}
            disabled={isMinting}
            className="flex-1 sm:flex-none px-6 py-2 rounded-xl text-sm font-bold bg-brand text-black hover:bg-brand-hover transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
          >
            {isMinting ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Mint as NFT
          </button>
        </div>
      </div>
      {archiveError && (
        <p className="text-error text-xs mt-2 text-center" role="alert">
          {archiveError}
        </p>
      )}

      {/* Delete confirmation — deletion is not undoable from the UI, so it is
          always gated behind an explicit confirm. */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-clips-title"
            className="relative bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-clips-title" className="text-lg font-bold text-white mb-2">
              Delete {count} {clipNoun}?
            </h3>
            <p className="text-sm text-muted mb-6">This cannot be undone.</p>
            {deleteError && <p className="text-error text-xs mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-white text-sm font-medium hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Platform picker modal */}
      {showPlatformPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowPlatformPicker(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Post to platforms</h3>
            <div className="space-y-2 mb-6">
              {PLATFORMS.map((p) => (
                <label key={p} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer">
                  <input type="checkbox" checked={selectedPlatforms.includes(p)} onChange={() => setSelectedPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])} className="accent-brand" />
                  <span className="text-white font-medium text-sm capitalize">{p}</span>
                </label>
              ))}
            </div>
            {postError && <p className="text-error text-xs mb-3">{postError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowPlatformPicker(false)} className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-white text-sm font-medium hover:bg-white/5">Cancel</button>
              <button onClick={handlePostConfirm} disabled={selectedPlatforms.length === 0 || isPosting} className="flex-1 px-4 py-2 rounded-xl bg-brand text-black text-sm font-bold hover:bg-brand-hover disabled:opacity-50">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}