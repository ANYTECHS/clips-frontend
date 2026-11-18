import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackgroundGlow from "@/components/shared/BackgroundGlow";

interface LandingLayoutProps {
  children: React.ReactNode;
}

export default function LandingLayout({ children }: LandingLayoutProps) {
  return (
    <div className="min-h-screen text-[#F4F7EF] font-sans flex flex-col relative overflow-hidden bg-[#020D08]">
      <BackgroundGlow variant="landing" />
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12 flex items-center justify-center z-10 relative">
        {children}
      </main>
      <Footer />
    </div>
  );
}
