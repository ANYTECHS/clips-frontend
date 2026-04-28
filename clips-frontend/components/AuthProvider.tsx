"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../app/lib/mockApi";
import { useRouter, usePathname } from "next/navigation";
import { useUserStore } from "@/app/store";
import { useSession, signOut } from "next-auth/react";

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
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      // Map session user to User type
      const mappedUser: User = {
        id: session.user.id || session.user.email!, // Assuming email as id if not provided
        email: session.user.email!,
        name: session.user.name || "",
        username: session.user.name || "",
        onboardingStep: (session.user as any).onboardingStep || 1, // From callback
      };
      setUserState(mappedUser);
      localStorage.setItem("clipcash_user", JSON.stringify(mappedUser));
      const userProfile = {
        id: mappedUser.id,
        name: mappedUser.name || mappedUser.username || "User",
        email: mappedUser.email,
        avatarUrl: null,
        plan: "pro" as const,
        planUsagePercent: 80,
      };
      setProfile(userProfile);
    } else {
      // Load from local storage if no session
      const storedUser = localStorage.getItem("clipcash_user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUserState(parsedUser);
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
    }
    setIsLoading(false);
  }, [session, status]);

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
    signOut({ callbackUrl: "/login" });
    setUser(null);
  };

  // Basic routing logic based on auth state
  useEffect(() => {
    if (isLoading || status === "loading") return;

    const protectedRoutes = ["/dashboard", "/onboarding", "/earnings", "/projects", "/vault", "/platforms", "/clips"];
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
    const isAuthRoute = pathname === "/login" || pathname === "/signup";

    if (user || session) {
      if (isAuthRoute || pathname === "/") {
        if (user?.onboardingStep === 1 || user?.onboardingStep === 2) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      } else if (pathname === "/onboarding") {
        if (user?.onboardingStep && user.onboardingStep > 2) {
          router.push("/dashboard");
        }
      }
    } else {
      if (isProtectedRoute) {
        router.push("/login");
      }
    }
  }, [user, session, isLoading, status, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
