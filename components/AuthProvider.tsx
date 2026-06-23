"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { mapSessionToUser, persistClipcashUser, clearClipcashUser } from "@/app/lib/authUser";
import type { User } from "@/app/lib/mockApi";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize user from localStorage and NextAuth session
  // Note: Route protection is now handled by middleware.ts at the edge.
  // This component is responsible for auth state management only.
  useEffect(() => {
    const initializeAuth = () => {
      // First check if we have a persisted user in localStorage
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("clipcash_user");
        if (stored) {
          try {
            setUser(JSON.parse(stored));
          } catch (e) {
            clearClipcashUser();
          }
        }
      }

      // Update user from NextAuth session
      if (status === "authenticated" && session?.user) {
        const mappedUser = mapSessionToUser(session);
        setUser(mappedUser);
        persistClipcashUser(mappedUser);
      } else if (status === "unauthenticated") {
        setUser(null);
        clearClipcashUser();
      }

      // Mark auth as ready when session is loaded
      if (status !== "loading") {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [session, status]);

  // Handle session expiration and cleanup
  // Keep this as a fallback safety layer, though middleware should catch most cases
  useEffect(() => {
    if (status === "unauthenticated" && user) {
      clearClipcashUser();
      setUser(null);
      void signOut({ redirect: false });
    }
  }, [status, user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
