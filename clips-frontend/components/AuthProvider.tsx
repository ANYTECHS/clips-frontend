"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../app/lib/mockApi";
import { useRouter, usePathname } from "next/navigation";

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

  useEffect(() => {
    // Load from local storage on mount
    const storedUser = localStorage.getItem("clipcash_user");
    if (storedUser) {
      try {
        setUserState(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem("clipcash_user");
      }
    }
    setIsLoading(false);
  }, []);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem("clipcash_user", JSON.stringify(newUser));
    } else {
      localStorage.removeItem("clipcash_user");
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
