"use client";

/**
 * BulkActionBar — actions for a multi-selection of clips (Issue #1059).
 *
 * Appears once anything is selected and stays pinned to the bottom of the
 * viewport, so the selection made while scrolling is still actionable without
 * scrolling back.
 *
 * Destructive and irreversible actions confirm first; the rest fire directly.
 * Progress is rendered inline rather than in a modal — a bulk tag across four
 * pages should not block the list the user is still reading.
 */

import React, { useState } from "react";
import { Download, Loader2, Send, Tag, Trash2, X } from "lucide-react";

import type { BulkProgress } from "@/app/hooks/useBulkOperation";

export type BulkActionId = "delete" | "export" | "post" | "tag";

export interface BulkActionBarProps {
  selectedCount: number;
  /** Count on the current page, when it differs from the total selection. */
  visibleSelectedCount?: number;
  progress: BulkProgress;
  onDelete: () => void;
  onExport: () => void;
  onPost: () => void;
  onTag: () => void;
  onClear: () => void;
  onCancel?: () => void;
  /** Actions to hide — e.g. posting is meaningless in an archive view. */
  disabledActions?: readonly BulkActionId[];
}

export default function BulkActionBar({
  selectedCount,
  visibleSelectedCount,
  progress,
  onDelete,
  onExport,
  onPost,
  onTag,
  onClear,
  onCancel,
  disabledActions = [],
}: BulkActionBarProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (selectedCount === 0) return null;

  const busy = progress.isRunning;
  const isDisabled = (action: BulkActionId) => busy || disabledActions.includes(action);

  // Surfaced because the selection deliberately spans pages: someone who
  // selected 12 on page 1 and 8 on page 2 needs to know a delete covers 20.
  const offPageCount =
    visibleSelectedCount === undefined ? 0 : selectedCount - visibleSelectedCount;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-950/95 backdrop-blur px-4 py-3 sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3">
        {busy && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-white/80">
              <span>
                Processing {progress.processed} of {progress.total}
                {progress.failures.length > 0 && (
                  <span className="ml-2 text-amber-400">
                    {progress.failures.length} failed
                  </span>
                )}
              </span>
              <span>{progress.percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Bulk operation progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-200 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {!busy && progress.isComplete && progress.failures.length > 0 && (
          <p role="alert" className="text-xs text-amber-400">
            {progress.succeeded} succeeded, {progress.failures.length} failed. The
            ones that failed are still selected.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">
              {selectedCount} selected
            </span>
            {offPageCount > 0 && (
              <span className="text-xs text-white/50">
                ({offPageCount} on other pages)
              </span>
            )}
            <button
              type="button"
              onClick={onClear}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/60 transition-colors hover:text-white disabled:opacity-40"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <BulkButton
              icon={<Tag className="h-4 w-4" aria-hidden="true" />}
              label="Tag"
              onClick={onTag}
              disabled={isDisabled("tag")}
            />
            <BulkButton
              icon={<Download className="h-4 w-4" aria-hidden="true" />}
              label="Export"
              onClick={onExport}
              disabled={isDisabled("export")}
            />
            <BulkButton
              icon={<Send className="h-4 w-4" aria-hidden="true" />}
              label="Post"
              onClick={onPost}
              disabled={isDisabled("post")}
            />

            {confirmingDelete ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1">
                <span className="text-xs text-red-200">
                  Delete {selectedCount}?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    onDelete();
                  }}
                  className="rounded px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded px-2 py-1 text-xs text-white/60 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <BulkButton
                icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                label="Delete"
                onClick={() => setConfirmingDelete(true)}
                disabled={isDisabled("delete")}
                destructive
              />
            )}

            {busy && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/5"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Stop
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BulkButton({
  icon,
  label,
  onClick,
  disabled,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        destructive
          ? "border-red-500/40 text-red-300 hover:bg-red-500/10"
          : "border-white/15 text-white hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
