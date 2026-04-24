"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function ProcessingHeader() {
  const { user } = useAuth();
  
  return (
    <header className="w-full flex items-center justify-between px-6 py-5 bg-transparent border-b border-white/5 relative z-50">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-black shadow-[0_0_15px_rgba(0,229,143,0.3)]">
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M7 8h10" />
            <path d="M7 12h10" />
            <path d="M7 16h10" />
          </svg>
        </div>
        <span className="text-white font-bold text-xl tracking-tight">ClipCash AI</span>
      </div>

      {/* Center: Navigation Links */}
      <nav className="hidden md:flex items-center gap-8">
        <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Dashboard</Link>
        <Link href="/clips" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">My Clips</Link>
        <Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Pricing</Link>
        <Link href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">Support</Link>
      </nav>


      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        <button className="hidden sm:block px-5 py-2.5 bg-brand hover:bg-brand-hover text-black font-bold text-sm rounded-full transition-all shadow-[0_0_20px_rgba(0,229,143,0.25)] hover:shadow-[0_0_30px_rgba(0,229,143,0.4)] hover:-translate-y-0.5 active:translate-y-0">
          Upgrade Plan
        </button>
        <div className="w-10 h-10 rounded-full border border-white/10 bg-zinc-800 flex items-center justify-center overflow-hidden">
          <img 
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.profile?.username || "default"}`} 
            alt="User Avatar" 
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </header>
  );
}
