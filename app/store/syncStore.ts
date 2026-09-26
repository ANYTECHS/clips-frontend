"use client";

/**
 * Data synchronization status store (#909).
 *
 * A single place that tracks, per named resource ("dashboard", "earnings",
 * ...), whether its data is synced with the server, currently syncing, stuck
 * behind a network error, offline, or was just resolved from a conflict.
 * Components that stream or poll data report into this store; a single
 * `SyncStatusIndicator` can then show the aggregate state anywhere in the UI
 * without each feature reinventing its own status badge.
 */

import { create } from "zustand";

export type SyncStatus = "idle" | "syncing" | "synced" | "conflict" | "error" | "offline";

export interface ResourceSyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
}

interface SyncStoreState {
  /** Per-resource sync state, keyed by an arbitrary resource name. */
  resources: Record<string, ResourceSyncState>;
  /** Whether the browser reports a network connection. */
  isOnline: boolean;

  setStatus: (resource: string, status: SyncStatus, error?: string | null) => void;
  markSynced: (resource: string) => void;
  markConflict: (resource: string) => void;
  setOnline: (isOnline: boolean) => void;
  getResourceStatus: (resource: string) => ResourceSyncState;
}

const DEFAULT_RESOURCE_STATE: ResourceSyncState = {
  status: "idle",
  lastSyncedAt: null,
  error: null,
};

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  resources: {},
  isOnline: true,

  setStatus: (resource, status, error = null) =>
    set((state) => ({
      resources: {
        ...state.resources,
        [resource]: {
          status,
          error,
          lastSyncedAt:
            status === "synced" ? Date.now() : state.resources[resource]?.lastSyncedAt ?? null,
        },
      },
    })),

  markSynced: (resource) =>
    set((state) => ({
      resources: {
        ...state.resources,
        [resource]: { status: "synced", error: null, lastSyncedAt: Date.now() },
      },
    })),

  markConflict: (resource) =>
    set((state) => ({
      resources: {
        ...state.resources,
        [resource]: {
          ...(state.resources[resource] ?? DEFAULT_RESOURCE_STATE),
          status: "conflict",
        },
      },
    })),

  setOnline: (isOnline) => set({ isOnline }),

  getResourceStatus: (resource) => get().resources[resource] ?? DEFAULT_RESOURCE_STATE,
}));

export const selectResourceStatus = (resource: string) => (state: SyncStoreState) =>
  state.resources[resource] ?? DEFAULT_RESOURCE_STATE;

export const selectIsOnline = (state: SyncStoreState) => state.isOnline;

// Track browser connectivity globally — every resource's indicator can fall
// back to "offline" the moment the network drops, rather than waiting for
// its own stream to time out.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => useSyncStore.getState().setOnline(true));
  window.addEventListener("offline", () => useSyncStore.getState().setOnline(false));
  useSyncStore.setState({ isOnline: navigator.onLine });
}
