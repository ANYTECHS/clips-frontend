"use client";

import React, { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/components/AuthProvider";
import { useState, useEffect } from "react";

interface LandingLayoutProps {
  /**
   * Hero content to display on the left side of the landing page.
   * This is the unique part that differs between / and /login pages.
   */
  hero: ReactNode;

  /**
   * Whether to show the auth form loading skeleton while auth state initializes.
   * Set to true for pages that should check auth state before rendering.
   * Default: false (for pages like /login that always show auth form)
   */
  showAuthLoadingSkeleton?: boolean;

  /**
   * Auth form mode ("login" or "signup").
   * Default: "login"
   */
  authFormMode?: "login" | "signup";

  /**
   * Optional className for the main container.
   */
  className?: string;

  /**
   * Optional className for the hero section.
   */
  heroClassName?: string;

  /**
   * Optional className for the auth form container.
   */
  authFormContainerClassName?: string;
}

export default function LandingLayout({
  hero,
  showAuthLoadingSkeleton = false,
  authFormMode = "login",
  className = "",
  heroClassName = "",
  authFormContainerClassName = "",
}: LandingLayoutProps) {
  const { isLoading: authLoading } = showAuthLoadingSkeleton ? useAuth() : { isLoading: false };
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className={`min-h-screen text-white font-sans flex flex-col relative overflow-hidden bg-background ${className}`}>
      {/* Background Orbs */}
      <div className="fixed top-0 left-0 w-[800px] h-[800px] bg-brand/10 rounded-full blur-[150px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.07] rounded-full blur-[120px] pointer-events-none translate-x-1/3" />
      <div className="fixed bottom-0 left-1/2 w-[800px] h-[800px] bg-brand/5 rounded-full blur-[150px] pointer-events-none -translate-x-1/2 translate-y-1/2" />

      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 flex items-center z-10 relative">
        <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-8 animate-in fade-in duration-700 zoom-in-95 mt-[-40px]">
          {/* Left side - Hero Content */}
          <div className={`flex-1 ${heroClassName}`}>
            {hero}
          </div>

          {/* Right side - Auth Form */}
          <div className={`w-full max-w-[440px] flex justify-end ${authFormContainerClassName}`}>
            {showAuthLoadingSkeleton && (!isMounted || authLoading) ? (
              // Loading skeleton
              <AuthFormSkeleton />
            ) : (
              <AuthForm mode={authFormMode} />
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/**
 * Loading skeleton that matches the AuthForm component layout.
 * Used while auth state is initializing.
 */
function AuthFormSkeleton() {
  return (
    <div className="w-full max-w-[440px] bg-input/40 border border-subtle rounded-[20px] p-8 backdrop-blur-sm animate-pulse">
      <div className="h-8 bg-subtle rounded w-3/4 mb-2" />
      <div className="h-4 bg-subtle rounded w-1/2 mb-8" />

      {/* Email field skeleton */}
      <div className="space-y-4 mb-6">
        <div>
          <div className="h-4 bg-subtle rounded w-1/4 mb-2" />
          <div className="h-10 bg-subtle rounded" />
        </div>
        <div>
          <div className="h-4 bg-subtle rounded w-1/4 mb-2" />
          <div className="h-10 bg-subtle rounded" />
        </div>
        <div className="h-10 bg-brand/30 rounded" />
      </div>

      {/* Divider skeleton */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-subtle" />
        </div>
      </div>

      {/* OAuth buttons skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-subtle rounded" />
        ))}
      </div>
    </div>
  );
}
