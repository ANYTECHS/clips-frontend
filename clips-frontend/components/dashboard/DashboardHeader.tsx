"use client";

import React from "react";
import { Upload, Bell, Menu } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import WalletConnectButton from "@/components/WalletConnectButton";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function DashboardHeader({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] || user?.profile?.username || "Guest";

  return (
    <header className="flex justify-between items-center py-6 lg:py-8 px-4 sm:px-6 lg:px-10">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-[#8e9895] hover:text-white transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="space-y-0.5 sm:space-y-1">
          <h1 className="text-[24px] sm:text-[32px] font-extrabold tracking-tight text-white leading-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-[#8e9895] text-[13px] sm:text-[15px] hidden sm:block">
            Your AI is currently processing <span className="text-white font-medium">3 new viral clips</span> from your last stream.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:block">
          <WalletConnectButton compact />
        </div>

        <button className="w-11 h-11 rounded-xl bg-[#111111] border border-white/5 flex items-center justify-center text-[#8e9895] hover:text-white transition-colors relative">
          <Bell className="w-5 h-5" />
          <div className="absolute top-3 right-3 w-2 h-2 bg-brand rounded-full border-2 border-[#111111]" />
        </button>
        
        <button className="bg-brand hover:bg-brand-hover text-black px-6 py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2.5 transition-all shadow-[0_0_20px_rgba(0,229,143,0.15)] hover:shadow-[0_0_30px_rgba(0,229,143,0.25)] active:scale-[0.97]">
          <Upload className="w-4.5 h-4.5" />
          Quick Upload
        </button>
      </div>
    </header>
  );
}
