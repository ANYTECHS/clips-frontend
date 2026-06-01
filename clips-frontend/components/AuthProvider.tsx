"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { User } from "../app/lib/mockApi";
import { useRouter, usePathname } from "next/navigation";
import { useUserStore, useDashboardStore, useEarningsStore } from "@/app/store";
import { useSession, signOut } from "next-auth/react";
import { getAuthRedirectTarget } from "@/app/lib/authRedirect";
import {
  mapSessionToUser,
  persistClipcashUser,
  clearClipcashUser,
} from "@/app/lib/authUser";

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
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

type AuthSource = "session" | "mock" | null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authSourceRef = useRef<AuthSource>(null);
  const syncedSessionEmailRef = useRef<string | null>(null);
  const pendingRedirectRef = useRef<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const setProfile = useUserStore((state) => state.setProfile);
  const clearUser = useUserStore((state) => state.clearUser);
  const { data: session, status } = useSession();

  const syncUserProfile = useCallback(
    (nextUser: User) => {
      setProfile({
        id: nextUser.id,
        name: nextUser.name || nextUser.username || "User",
        email: nextUser.email,
        avatarUrl: null,
        plan: "pro" as const,
        planUsagePercent: 80,
      });
      useDashboardStore.getState().fetchDashboard();
      useEarningsStore.getState().fetchEarnings();
    },
    [setProfile]
  );

  const clearAuthState = useCallback(() => {
    authSourceRef.current = null;
    syncedSessionEmailRef.current = null;
    setUserState(null);
    clearClipcashUser();
    clearUser();
  }, [clearUser]);

  useEffect(() => {
    if (status === "loading") {
      setIsLoading(true);
      return;
    }

    if (status === "authenticated" && session?.user?.email) {
      const sessionEmail = session.user.email;
      if (
        authSourceRef.current !== "session" ||
        syncedSessionEmailRef.current !== sessionEmail
      ) {
        authSourceRef.current = "session";
        syncedSessionEmailRef.current = sessionEmail;
        const nextUser = mapSessionToUser(session);
        setUserState(nextUser);
        persistClipcashUser(nextUser);
        syncUserProfile(nextUser);
      }
      setIsLoading(false);
      return;
    }

    if (status === "unauthenticated") {
      syncedSessionEmailRef.current = null;
      if (authSourceRef.current === "session") {
        clearAuthState();
        void signOut({ redirect: false });
      }
    }

    setIsLoading(false);
  }, [session, status, clearAuthState, syncUserProfile]);

  useEffect(() => {
    const redirectTo = getAuthRedirectTarget({
      pathname,
      user,
      isAuthReady: !isLoading && status !== "loading",
    });

    if (!redirectTo || redirectTo === pathname) {
      pendingRedirectRef.current = null;
      return;
    }

    if (pendingRedirectRef.current === redirectTo) {
      return;
    }

    pendingRedirectRef.current = redirectTo;
    router.push(redirectTo);
  }, [user, isLoading, status, pathname, router]);

  const setUser = (newUser: User | null) => {
    if (newUser) {
      const { password: _password, ...safeUser } = newUser as User & {
        password?: string;
      };
      void _password;
      authSourceRef.current = "mock";
      syncedSessionEmailRef.current = null;
      setUserState(safeUser as User);
      persistClipcashUser(safeUser as User);
      syncUserProfile(safeUser as User);
    } else {
      clearAuthState();
    }
  };

  const logout = () => {
    signOut({ callbackUrl: "/login" });
    clearAuthState();
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
