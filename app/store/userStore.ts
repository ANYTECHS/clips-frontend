"use client";

/**
 * User Zustand store
 *
 * Holds the authenticated user's profile data.
 * Replaces the hardcoded DUMMY_USER objects scattered across components
 * (DashboardHeader, Sidebar, etc.).
 *
 * Usage:
 *   const { profile, loading } = useUserStore();
 *   const name = useUserStore(selectUserName);  // fine-grained subscription
 */

import { create } from "zustand";
import type { UserState, UserActions, UserProfile } from "./types";

import { fetchUserFromAPI } from "./api";

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: UserState = {
  profile: null,
  loading: false,
  error: null,
};

// ─── Plan change callbacks ────────────────────────────────────────────────────

const planChangeCallbacks = new Set<(newPlan: UserProfile["plan"]) => void>();

function computeQuotaRemaining(plan: UserProfile["plan"], usagePercent: number): number {
  const limits: Record<UserProfile["plan"], number> = {
    free: 10,
    pro: 100,
    enterprise: 1000,
  };
  const limit = limits[plan] ?? 10;
  return Math.max(0, limit - Math.round((usagePercent / 100) * limit));
}

function enrichProfile(profile: UserProfile | null): UserProfile | null {
  if (!profile) return null;
  const transformQuotaRemaining =
    profile.transformQuotaRemaining ??
    computeQuotaRemaining(profile.plan, profile.planUsagePercent);
  return { ...profile, transformQuotaRemaining };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUserStore = create<UserState & UserActions>((set, get) => ({
  ...initialState,

  fetchUser: async () => {
    set({ loading: true, error: null });
    try {
      const rawProfile = await fetchUserFromAPI();
      const profile = enrichProfile(rawProfile);
      const previousProfile = get().profile;

      // Check if plan changed and notify callbacks
      if (previousProfile && profile && previousProfile.plan !== profile.plan) {
        planChangeCallbacks.forEach((callback) => callback(profile.plan));
      }

      set({ profile, loading: false });
    } catch (err) {
      set({
        loading: false,
        error:
          err instanceof Error ? err.message : "Failed to fetch user profile",
      });
    }
  },

  setProfile: (rawProfile: UserProfile) => {
    const previousProfile = get().profile;
    const profile = enrichProfile(rawProfile);

    // Check if plan changed and notify callbacks
    if (previousProfile && profile && previousProfile.plan !== profile.plan) {
      planChangeCallbacks.forEach((callback) => callback(profile.plan));
    }

    set({ profile });
  },

  clearUser: () => set(initialState),

  onPlanChange: (callback: (newPlan: UserProfile["plan"]) => void) => {
    planChangeCallbacks.add(callback);
    // Return unsubscribe function
    return () => {
      planChangeCallbacks.delete(callback);
    };
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectUserProfile = (s: UserState & UserActions) => s.profile;

export const selectUserName = (s: UserState & UserActions) =>
  s.profile?.name ?? "there";

export const selectUserEmail = (s: UserState & UserActions) =>
  s.profile?.email ?? "";

export const selectUserAvatar = (s: UserState & UserActions) =>
  s.profile?.avatarUrl ?? null;

export const selectUserPlan = (s: UserState & UserActions) =>
  s.profile?.plan ?? "free";

export const selectPlanUsage = (s: UserState & UserActions) =>
  s.profile?.planUsagePercent ?? 0;

export const selectTransformQuotaRemaining = (s: UserState & UserActions) =>
  s.profile?.transformQuotaRemaining ??
  computeQuotaRemaining(s.profile?.plan ?? "free", s.profile?.planUsagePercent ?? 0);

export const selectUserLoading = (s: UserState & UserActions) => s.loading;
