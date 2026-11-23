"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  Suspense,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import apiClient from "@/lib/apiClient";
import { disconnectWallet } from "@/lib/wallet";
import { watchIdleSession } from "@/lib/sessionTimeout";

export interface User {
  id: string;
  email?: string;
  stellarAddress?: string;
  fullName: string;
  username?: string;
  picture?: string;
  onboardingStep: number;
  profile: {
    username?: string;
    niche?: string;
    socialsConnected?: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  /** Call setUser after login/signup. Pass skipRedirect=true when you are
   *  handling navigation yourself (e.g. new signup → /onboarding). */
  setUser: (user: User | null, skipRedirect?: boolean) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  logout: () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // When AuthForm handles routing itself (e.g. new signup → /onboarding),
  // it passes skipRedirect=true so this effect doesn't fight it.
  const skipRedirectRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initial session check on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await apiClient.get("/users/me");
        let userData = response.data;
        if (userData && typeof window !== "undefined") {
          if (userData.id) {
            localStorage.setItem("clipcash_current_user_id", String(userData.id));
          }
          if (userData.email) {
            localStorage.setItem("clipcash_current_user_email", String(userData.email).toLowerCase());
          }
          if (userData.stellarAddress) {
            localStorage.setItem("clipcash_current_user_address", String(userData.stellarAddress).toLowerCase());
          }

          const cachedUsername =
            localStorage.getItem(`clipcash_username_${userData.id}`) ||
            localStorage.getItem("clipcash_username");
          if (!userData.username && cachedUsername) {
            userData = {
              ...userData,
              username: cachedUsername,
              profile: { ...(userData.profile || {}), username: cachedUsername },
            };
          }
        }
        setUserState(userData);
      } catch (error: any) {
        const status = error.response?.status;
        if (status !== 401 && status !== 503) {
          console.error("Auth check failed:", error);
        }
        setUserState(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  // Navigation guard — runs whenever auth state or route changes
  useEffect(() => {
    if (isLoading) return;

    // If AuthForm explicitly handled routing, skip this effect once
    if (skipRedirectRef.current) {
      skipRedirectRef.current = false;
      return;
    }

    const guestPaths = ["/login", "/signup", "/"];
    const isGuestPath = guestPaths.includes(pathname);

    // Wallet signup: unauthenticated user at /onboarding?wallet= — allow through
    const isWalletOnboarding =
      pathname.startsWith("/onboarding") && !!searchParams.get("wallet");

    if (user) {
      // Logged-in user on a guest page → send to dashboard
      if (isGuestPath) {
        router.push("/dashboard");
      }
      // All other paths (including /onboarding): leave the user where they are
    } else {
      const protectedPaths = [
        "/dashboard",
        "/projects",
        "/ai-projects",
        "/my-projects",
        "/clips",
        "/platforms",
        "/onboarding",
        "/settings",
        "/agent-marketplace",
      ];
      const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
      if (isProtected && !isWalletOnboarding) {
        router.push("/login");
      }
    }
  }, [user, isLoading, pathname, searchParams, router]);

  // Issue #1365 — idle session timeout: force re-authentication after the
  // configured idle window (default 30 min, NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES).
  useEffect(() => {
    if (!user || isLoading) return;
    return watchIdleSession(() => {
      void logout();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);

  /**
   * setUser — called by AuthForm after login or signup.
   * Pass skipRedirect=true when you are handling navigation yourself
   * (e.g. new signup → router.push("/onboarding")).
   */
  const setUser = (newUser: User | null, skipRedirect = false) => {
    if (skipRedirect) {
      skipRedirectRef.current = true;
    }
    if (newUser && typeof window !== "undefined") {
      if (newUser.id) {
        localStorage.setItem("clipcash_current_user_id", String(newUser.id));
      }
      if (newUser.email) {
        localStorage.setItem("clipcash_current_user_email", String(newUser.email).toLowerCase());
      }
      if (newUser.stellarAddress) {
        localStorage.setItem("clipcash_current_user_address", String(newUser.stellarAddress).toLowerCase());
      }
    }
    const resolvedUsername = newUser?.username || newUser?.profile?.username;
    if (resolvedUsername && typeof window !== "undefined") {
      if (newUser?.id) {
        localStorage.setItem(`clipcash_username_${newUser.id}`, resolvedUsername);
      }
      localStorage.setItem("clipcash_username", resolvedUsername);
    }
    setUserState(newUser);
  };

  const logout = async () => {
    try {
      await apiClient.post("/auths/logout");
    } catch {
      // ignore
    } finally {
      if (typeof window !== "undefined") {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("clipcash_") || key.startsWith("clp_"))) {
            if (!key.includes("free_agent_job")) {
              keysToRemove.push(key);
            }
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      }
      // Disconnect wallet so the address is cleared from the kit and localStorage.
      // This is a no-op if no wallet was connected (email users).
      try {
        await disconnectWallet();
      } catch {
        // ignore — wallet may not have been connected
      }
      setUserState(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </Suspense>
  );
}
