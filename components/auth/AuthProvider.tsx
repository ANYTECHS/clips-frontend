"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { persistClipcashUser, loadClipcashUser, clearClipcashUser } from "@/app/lib/authUser";

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
AuthContext.displayName = "AuthContext";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUserState] = useState<AuthUser | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);

  // Load persisted user on mount (async secureStorage, checks TTL)
  useEffect(() => {
    loadClipcashUser().then((stored) => {
      if (stored) setUserState(stored as AuthUser);
      setStorageLoaded(true);
    });
  }, []);

  const isLoading = status === "loading" || !storageLoaded;

  // Sync NextAuth session -> local state
  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.user) {
      const { email, name } = session.user as { email?: string; name?: string };
      const sessionUser: AuthUser = {
        id: email ?? "oauth_user",
        email: email ?? "",
        name: name ?? undefined,
        onboardingStep: (session.user as { onboardingStep?: number }).onboardingStep,
      };
      setUserState(sessionUser);
      persistClipcashUser(sessionUser);
    } else if (status === "unauthenticated") {
      loadClipcashUser().then((stored) => {
        if (stored && !stored.id.startsWith("mock")) {
          clearClipcashUser();
          setUserState(null);
          signOut({ redirect: false });
        }
      });
    }
  }, [status, session]);

  // Route guard
  useEffect(() => {
    if (isLoading) return;
    if (status === "authenticated") return;
    const isPublic = PUBLIC_ROUTES.some(
      (r) => pathname === r || pathname.startsWith(r + "/")
    );
    if (!user && !isPublic) {
      router.push("/login");
    }
  }, [user, isLoading, status, pathname, router]);

  const setUser = useCallback((newUser: AuthUser) => {
    setUserState(newUser);
    persistClipcashUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    setUserState(null);
    await clearClipcashUser();
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
