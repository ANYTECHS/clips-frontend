"use client";

/**
 * Small status badge reporting whether a synchronized resource is up to
 * date, syncing, offline, in conflict, or errored (#909).
 */

import { useSyncStore, selectResourceStatus, selectIsOnline } from "@/app/store/syncStore";

const LABELS: Record<string, string> = {
  idle: "Not synced yet",
  syncing: "Syncing…",
  synced: "Synced",
  conflict: "Conflict resolved",
  error: "Sync error",
  offline: "Offline",
};

const DOT_CLASSES: Record<string, string> = {
  idle: "bg-zinc-500",
  syncing: "bg-brand animate-pulse",
  synced: "bg-emerald-500",
  conflict: "bg-amber-500",
  error: "bg-red-500",
  offline: "bg-zinc-500",
};

export interface SyncStatusIndicatorProps {
  /** Resource name reported into `useSyncStore`, e.g. "dashboard". */
  resource: string;
  className?: string;
}

export default function SyncStatusIndicator({ resource, className = "" }: SyncStatusIndicatorProps) {
  const { status } = useSyncStore(selectResourceStatus(resource));
  const isOnline = useSyncStore(selectIsOnline);

  const effectiveStatus = !isOnline ? "offline" : status;

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[effectiveStatus]}`} aria-hidden="true" />
      {LABELS[effectiveStatus]}
    </div>
  );
}
