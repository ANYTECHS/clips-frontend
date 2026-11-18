"use client";

import React from "react";
import { Menu } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import WalletButton from "@/components/shared/WalletButton";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function DashboardHeader({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const firstName = user?.username || user?.profile?.username || user?.fullName?.split(" ")[0] || "there";

  return (
    <header className="w-full border-b border-[#0e4d2a]/50 bg-[#020D08]/40 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto flex justify-between items-center py-4 sm:py-6 lg:py-8 px-4 sm:px-6 lg:px-10 gap-2 sm:gap-4">
        {/* Left: Hamburger menu & Greeting */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-[#90A89C] hover:text-[#F4F7EF] transition-colors shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="min-w-0">
            <h1 className="text-[17px] xs:text-[20px] sm:text-[26px] lg:text-[32px] font-extrabold tracking-tight text-[#F4F7EF] leading-tight truncate">
              Welcome back, {firstName}
            </h1>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <WalletButton
            responsiveCompact
            className="h-10 sm:h-11 px-3 sm:px-4 rounded-xl bg-[#06351C] border border-[#0e4d2a] text-[#F4F7EF] hover:border-[#39FF14]/40 hover:bg-[#084223] transition-all text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 shadow-sm"
          />
          {/* <button
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#06351C] border border-[#0e4d2a] flex items-center justify-center text-[#90A89C] hover:text-[#F4F7EF] hover:border-[#39FF14]/40 transition-colors relative shrink-0"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
          </button> */}

          <div className="relative group shrink-0">
            <button
              disabled
              aria-disabled="true"
              className="h-10 sm:h-11 bg-[#B6FF4A]/15 text-[#B6FF4A]/50 px-3 sm:px-5 lg:px-6 rounded-xl font-bold text-[12px] sm:text-[14px] flex items-center justify-center gap-1.5 sm:gap-2 cursor-not-allowed select-none border border-[#B6FF4A]/25 transition-colors whitespace-nowrap"
              title="Coming soon"
            >
              New Clip
            </button>
            <div className="absolute bottom-full mb-2.5 right-0 sm:left-1/2 sm:-translate-x-1/2 px-2.5 py-1 bg-[#042413] text-[#B6FF4A] border border-[#0e4d2a] text-[11px] font-bold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-30">
              Coming soon
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
