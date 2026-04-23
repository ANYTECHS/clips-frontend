"use client";

import React, { useState } from "react";
import Link from "next/link";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import SectionHeader from "@/components/platforms/SectionHeader";
import PlatformCard from "@/components/platforms/PlatformCard";
import HelpBanner from "@/components/platforms/HelpBanner";
import PlatformsFooter from "@/components/platforms/PlatformsFooter";
import { 
  Search, 
  Bell, 
  Share2, 
  Wallet,
  Menu,
  Settings,
  AlertCircle,
  X
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useWallet, truncateAddress } from "@/components/WalletProvider";

// Custom Figma Icons
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="url(#instaGradient)"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" stroke="url(#instaGradient)"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="url(#instaGradient)"></line>
    <defs>
      <linearGradient id="instaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f09433" />
        <stop offset="50%" stopColor="#dc2743" />
        <stop offset="100%" stopColor="#bc1888" />
      </linearGradient>
    </defs>
  </svg>
);

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="white"></path>
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="#ee1d52" className="opacity-50 translate-x-0.5 translate-y-0.5"></path>
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="#69C9D0" className="opacity-50 -translate-x-0.5 -translate-y-0.5"></path>
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z" fill="#FF0000" stroke="#FF0000"></path>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="white"></polygon>
  </svg>
);

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z"></path>
  </svg>
);

const PhantomIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#AB9FF2" fill="#AB9FF2" fillOpacity="0.1"></path>
    <circle cx="12" cy="12" r="3" stroke="#AB9FF2"></circle>
  </svg>
);

const MetaMaskIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M22 6.5l-2.5-3L12 2 4.5 3.5 2 6.5l3 2 7 5 7-5 3-2z" fill="#E2761B"></path>
    <path d="M12 22l-7-5 2-7.5 5 3.5 5-3.5 2 7.5-7 5z" fill="#E2761B"></path>
  </svg>
);

export default function PlatformsPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    isConnected: walletConnected,
    isConnecting: walletConnecting,
    address: walletAddress,
    error: walletError,
    connectMetaMask,
    disconnect: disconnectWallet,
    clearError: clearWalletError,
  } = useWallet();

  return (
    <div className="flex min-h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Background Glows */}
      <div className="fixed top-0 left-0 w-[50vw] h-[50vw] rounded-full bg-brand/5 blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
      <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.03] rounded-full blur-[100px] pointer-events-none translate-x-1/3" />

      {/* Sidebar Backdrop Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide relative z-10">
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between py-5 px-4 sm:px-6 lg:px-10 border-b border-white/[0.03] bg-[#050505]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-12"> 
            <nav className="hidden lg:flex items-center gap-8 text-[13px] font-bold uppercase tracking-wider text-[#5A6F65]">
              {["Connections", "Clips"].map((item) => (
                <Link 
                  key={item} 
                  href={item === "Connections" ? "/platforms" : "/clips"}
                  className={`hover:text-white transition-colors relative py-1 ${item === "Connections" ? "text-brand" : "text-[#5A6F65]"}`}
                >
                  {item}
                  {item === "Connections" && (
                    <div className="absolute -bottom-6 left-0 right-0 h-0.5 bg-brand shadow-[0_0_8px_rgba(0,255,156,0.5)]" />
                  )}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-[#5A6F65] hover:text-white transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="hidden md:flex items-center gap-3 bg-white/[0.02] border border-white/5 px-4 py-2 rounded-full w-56 group focus-within:border-brand/40 transition-all">
              <Search className="w-4 h-4 text-[#3A4A43]" />
              <input 
                type="text" 
                placeholder="Search platforms..." 
                className="bg-transparent border-none outline-none text-[12px] w-full text-white placeholder-[#3A4A43]"
              />
            </div>
            
            <button className="relative p-2.5 rounded-full bg-white/[0.02] border border-white/5 text-[#5A6F65] hover:text-white transition-all">
              <Bell className="w-5 h-5" />
              <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-brand rounded-full border-2 border-[#050505]" />
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-10 py-12 space-y-16 max-w-[1400px] mx-auto w-full">
          {/* Header */}
          <div className="space-y-3">
            <h1 className="text-[44px] sm:text-[56px] font-black tracking-tight text-white leading-tight">
              Connect <span className="text-brand">Accounts</span>
            </h1>
            <p className="text-[#5A6F65] text-[16px] sm:text-[18px] max-w-2xl font-medium leading-relaxed">Link your social media and Web3 wallets to start generating AI-powered clips and earning rewards automatically.</p>
          </div>

          {/* Social Platforms */}
          <section>
            <SectionHeader 
              title="Social Platforms" 
              icon={Share2} 
              label="4 CONNECTED" 
            />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <PlatformCard 
                name="TikTok" 
                username="@clip_creator_pro" 
                description="Manage your main TikTok video feed"
                icon={TikTokIcon} 
                status="ACTIVE" 
                ctaText="Manage"
                variant="vertical"
              />
              <PlatformCard 
                name="Instagram" 
                description="Connect to sync Reels"
                icon={InstagramIcon} 
                status="NOT LINKED" 
                ctaText="Connect Account"
                variant="vertical"
              />
              <PlatformCard 
                name="YouTube" 
                username="StudioX Channel" 
                description="Import and sync your long-form YouTube content"
                icon={YoutubeIcon} 
                status="ACTIVE" 
                ctaText="Manage"
                variant="vertical"
              />
              <PlatformCard 
                name="X / Twitter" 
                description="Auto-post clips to X"
                icon={TwitterIcon} 
                status="NOT LINKED" 
                ctaText="Connect Account"
                variant="vertical"
              />
            </div>
          </section>

          {/* Web3 Wallets */}
          <section>
            <SectionHeader 
              title="Web3 Wallets" 
              icon={Wallet} 
              label={walletConnected ? "1 CONNECTED" : "REWARDS DESTINATION"} 
            />

            {/* Wallet error banner */}
            {walletError && (
              <div className="flex items-start gap-3 bg-red-950/60 border border-red-500/25 rounded-2xl px-5 py-4 mb-6">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-[14px] text-red-300 leading-snug flex-1">{walletError}</p>
                <button
                  onClick={clearWalletError}
                  className="text-red-400 hover:text-red-200 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <PlatformCard 
                name="Phantom Wallet" 
                description="Solana Network"
                icon={PhantomIcon} 
                status="NOT LINKED" 
                ctaText="Connect Phantom"
                variant="horizontal"
              />
              <PlatformCard 
                name="MetaMask" 
                username={walletConnected && walletAddress ? truncateAddress(walletAddress) : undefined}
                description="Ethereum / L2s"
                icon={MetaMaskIcon} 
                status={walletConnected ? "LINKED" : "NOT LINKED"}
                ctaText={walletConnecting ? "Connecting..." : "Connect MetaMask"}
                variant="horizontal"
                onConnect={connectMetaMask}
                onDisconnect={disconnectWallet}
                isLoading={walletConnecting}
              />
            </div>
          </section>

          {/* Help Banner */}
          <HelpBanner />

          {/* Footer */}
          <PlatformsFooter />
        </div>
      </main>
    </div>
  );
}
