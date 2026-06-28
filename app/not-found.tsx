"use client";

import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Home, LayoutDashboard } from "lucide-react";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";

/**
 * app/not-found.tsx
 *
 * Custom 404 page rendered by Next.js App Router when no route matches.
 * Provides branding, navigation, and clear CTAs so users are never stranded.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#080C0B] text-white font-sans flex flex-col relative overflow-hidden">
      <BackgroundOrbs variant="subtle" />

      <Navbar />

      <main
        className="flex-1 flex flex-col items-center justify-center px-6 py-20 relative z-10"
        aria-labelledby="not-found-heading"
      >
        {/* Error code */}
        <div className="relative mb-6 select-none" aria-hidden="true">
          <span className="text-[120px] sm:text-[160px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-white/10 to-white/[0.03]">
            404
          </span>
          {/* Floating brand badge */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center shadow-[0_0_40px_rgba(0,229,143,0.15)]">
              <span className="text-3xl" role="img" aria-label="lightning">⚡</span>
            </div>
          </div>
        </div>

        {/* Heading */}
        <h1
          id="not-found-heading"
          className="text-[28px] sm:text-[36px] font-extrabold tracking-tight text-white text-center mb-3"
        >
          Page not found
        </h1>

        {/* Sub-copy */}
        <p className="text-[#8e9895] text-[15px] sm:text-[16px] text-center max-w-md leading-relaxed mb-10">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Head back to a safe place below.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 bg-brand hover:bg-brand-hover text-black px-7 py-3.5 rounded-full font-bold text-[14px] transition-all shadow-[0_0_20px_rgba(0,229,143,0.2)] hover:shadow-[0_0_30px_rgba(0,229,143,0.35)] hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
            Go to Dashboard
          </Link>

          <Link
            href="/"
            className="flex items-center gap-2.5 bg-[#101614] hover:bg-[#161D1A] border border-[#1E2923] hover:border-brand/30 text-white px-7 py-3.5 rounded-full font-bold text-[14px] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Go Home
          </Link>
        </div>

        {/* Divider + helpful hint */}
        <div className="mt-14 flex items-center gap-3 text-[#3A4A43] text-[12px]">
          <div className="w-1.5 h-1.5 rounded-full bg-brand/40" aria-hidden="true" />
          <span>Lost? Try the navigation above or return to the homepage.</span>
        </div>
      </main>
    </div>
  );
}
