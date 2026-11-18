/** 
 * Clips Page - enclips AI
 * This page handles the video import and clip generation process.
 */

import React from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/clips/Hero";
import CreateClipsForm from "@/components/clips/CreateClipsForm";
import ClipsStats from "@/components/clips/ClipsStats";
import BackgroundGlow from "@/components/shared/BackgroundGlow";

export default function ClipsPage() {
  return (
    <div className="min-h-screen bg-[#020D08] text-[#F4F7EF] font-sans selection:bg-[#B6FF4A]/30 selection:text-[#B6FF4A] relative overflow-x-hidden">
      <BackgroundGlow variant="simple" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar sticky />
        
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
