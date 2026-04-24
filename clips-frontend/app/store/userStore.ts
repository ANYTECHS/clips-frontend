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

// ─── Mock profile (replace fetchUserFromAPI with a real call) ─────────────────

const MOCK_PROFILE: UserProfile = {
  id: "usr_001",
  name: "Alex Rivera",
  email: "alex@clipcash.ai",
  avatarUrl: "/avatar.png",
  plan: "pro",
  planUsagePercent: 80,
};

async function fetchUserFromAPI(): Promise<UserProfile> {
  // TODO: replace with `fetch('/api/user/me')` when the endpoint is ready
  await new Promise((resolve) => setTimeout(resolve, 500));
  return MOCK_PROFILE;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: UserState = {
  profile: null,
  loading: false,
  error: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUserStore = create<UserState & UserActions>((set) => ({
  ...initialState,

  fetchUser: async () => {
    set({ loading: true, error: null });
    try {
      const profile = await fetchUserFromAPI();
      set({ profile, loading: false });
    } catch (err) {
      set({
        loading: false,
        error:
          err instanceof Error ? err.message : "Failed to fetch user profile",
      });
    }
  },

  setProfile: (profile: UserProfile) => set({ profile }),

  clearUser: () => set(initialState),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectUserProfile = (s: UserState & UserActions) => s.profile;

export const selectUserName = (s: UserState & UserActions) =>
  s.profile?.name ?? "there";

export const selectUserEmail = (s: UserState & UserActions) =>
  s.profile?.email ?? "";

export const selectUserAvatar = (s: UserState & UserActions) =>
  s.profile?.avatarUrl ?? null;

export const selectPlanUsage = (s: UserState & UserActions) =>
  s.profile?.planUsagePercent ?? 0;

export const selectUserLoading = (s: UserState & UserActions) => s.loading;
