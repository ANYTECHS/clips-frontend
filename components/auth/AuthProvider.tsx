"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";

const STORAGE_KEY = "clipcash_user";

const PUBLIC_ROUTES = ["/", "/login", "/privacy", "/terms", "/status", "/cookies"];

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  onboardingStep?: number;
  avatarUrl?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUserState] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  const isLoading = status === "loading";

  // Sync NextAuth session -> local state
  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.user) {
      const { email, name } = session.user as { email?: string; name?: string; onboardingStep?: number };
      const sessionUser: AuthUser = {
        id: email ?? "oauth_user",
        email: email ?? "",
        name: name ?? undefined,
        onboardingStep: (session.user as any).onboardingStep,
      };
      setUserState(sessionUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
    } else if (status === "unauthenticated") {
      // Only clear if we were previously synced from a session (not a manual mock login)
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const stored = JSON.parse(raw) as AuthUser;
          // If the stored user looks like it came from oauth (no explicit setUser call),
          // treat session expiry as a logout.
          if (!stored.id.startsWith("mock")) {
            localStorage.removeItem(STORAGE_KEY);
            setUserState(null);
            signOut({ redirect: false });
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
          setUserState(null);
        }
      }
    }
  }, [status, session]);

  // Route guard — only redirect when we know for certain the user is not authenticated
  useEffect(() => {
    if (isLoading) return;
    if (status === "authenticated") return; // session sync hasn't flushed to user state yet
    const isPublic = PUBLIC_ROUTES.some(
      (r) => pathname === r || pathname.startsWith(r + "/")
    );
    if (!user && !isPublic) {
      router.push("/login");
    }
  }, [user, isLoading, status, pathname, router]);

  const setUser = useCallback((newUser: AuthUser) => {
    setUserState(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  }, []);

  const logout = useCallback(async () => {
    setUserState(null);
    localStorage.removeItem(STORAGE_KEY);
    await signOut({ redirect: false });
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
