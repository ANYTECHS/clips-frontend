"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../app/lib/mockApi";
import { useRouter, usePathname } from "next/navigation";
import { useUserStore } from "@/app/store";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const setProfile = useUserStore((state) => state.setProfile);
  const clearUser = useUserStore((state) => state.clearUser);

  useEffect(() => {
    // Load from local storage on mount
    const storedUser = localStorage.getItem("clipcash_user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUserState(parsedUser);
        // Sync the stored user to useUserStore
        const userProfile = {
          id: parsedUser.id,
          name: parsedUser.name || parsedUser.username || "User",
          email: parsedUser.email,
          avatarUrl: null,
          plan: "pro" as const,
          planUsagePercent: 80,
        };
        setProfile(userProfile);
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem("clipcash_user");
        clearUser();
      }
    }
    setIsLoading(false);
  }, []);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem("clipcash_user", JSON.stringify(newUser));
      // Sync the authenticated user to useUserStore
      const userProfile = {
        id: newUser.id,
        name: newUser.name || newUser.username || "User",
        email: newUser.email,
        avatarUrl: null,
        plan: "pro" as const,
        planUsagePercent: 80,
      };
      setProfile(userProfile);
    } else {
      localStorage.removeItem("clipcash_user");
      clearUser();
    }
  };

  const logout = () => {
    setUser(null);
    router.push("/login");
  };

  // Basic routing logic based on auth state
  useEffect(() => {
    if (isLoading) return;

    const protectedRoutes = ["/dashboard", "/onboarding", "/earnings", "/projects", "/vault", "/platforms", "/clips"];
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
    const isAuthRoute = pathname === "/login" || pathname === "/signup";

    if (user) {
      if (isAuthRoute || pathname === "/") {
        if (user.onboardingStep === 1 || user.onboardingStep === 2) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      } else if (pathname === "/onboarding") {
        if (user.onboardingStep > 2) {
          router.push("/dashboard");
        }
      }
    } else {
      if (isProtectedRoute) {
        router.push("/login");
      }
    }
  }, [user, isLoading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
