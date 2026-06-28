"use client";

/** 
 * Clips Page - ClipCash AI
 * This page handles the video import and clip generation process.
 */

import React from "react";
import { useSession } from "next-auth/react";
import ClipsNavbar from "../../components/clips/ClipsNavbar";
import Hero from "../../components/clips/Hero";
// @TODO(Issue #18): CreateClipsForm and ClipsStats components are pending implementation.
// Once Issue #18 is resolved, these imports should resolve correctly.
import CreateClipsForm from "../../components/clips/CreateClipsForm";
import ClipsStats from "../../components/clips/ClipsStats";
import { Loader2 } from "lucide-react";

export default function ClipsPage() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    // Return empty or loading state while middleware redirects,
    // or an explicit fallback message if edge middleware is bypassed.
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-brand mb-4" />
        <p className="text-muted">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-brand/30 selection:text-brand relative overflow-x-hidden">
      {/* Background Glow Elements */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-screen pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand/5 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-brand/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <ClipsNavbar />
        
        <main className="flex-1 flex flex-col items-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-7xl mx-auto w-full space-y-12 sm:space-y-16">
          <Hero />
          
          <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
            <CreateClipsForm />
          </div>

          <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-12 delay-300 duration-1000 ease-out pb-20">
            <ClipsStats />
          </div>
        </main>
      </div>
    </div>
  );
}
