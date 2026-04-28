"use client";

import React, { useState, useMemo } from "react";
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
  AlertCircle,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useWallet, truncateAddress } from "@/components/WalletProvider";

/* ================= TYPES ================= */

type PlatformItem = {
  name: string;
  username?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "ACTIVE" | "NOT LINKED" | "LINKED";
  ctaText: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  isLoading?: boolean;
};

/* ================= ICONS ================= */

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <rect x="2" y="2" width="20" height="20" rx="5" />
  </svg>
);

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M22 6.5S21 4 19.5 3.5C18 3 12 3 12 3s-6 0-7.5.5C3 4 2 6.5 2 6.5S1 9 1 12s1 5.5 1 5.5 1 2.5 2.5 3C6 21 12 21 12 21s6 0 7.5-.5c1.5-.5 2.5-3 2.5-3S23 15 23 12s-1-5.5-1-5.5z" />
  </svg>
);

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M22 4s-1 1-2 1.5C19 4.5 18 4 17 4c-2 0-3 2-3 4v1C10 9 7 7 5 5c0 0-3 5 2 7-1 0-2 0-3-.5 0 2 2 4 4 4-1 .5-2 .5-3 .5 1 2 3 3 5 3 6 0 9-5 9-9v-1c1-.5 2-1.5 2-1.5z" />
  </svg>
);

const PhantomIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const MetaMaskIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <polygon points="12,2 22,20 2,20" />
  </svg>
);

/* ================= PAGE ================= */

export default function PlatformsPage() {
  const { user } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [phantomError, setPhantomError] = useState<string | null>(null);

  const {
    isConnected: walletConnected,
    isConnecting: walletConnecting,
    address: walletAddress,
    error: walletError,
    connectMetaMask,
    disconnect: disconnectWallet,
    clearError: clearWalletError,
  } = useWallet();

  /* ================= DATA ================= */

  const socialPlatforms: PlatformItem[] = [
    {
      name: "TikTok",
      username: "@clip_creator_pro",
      description: "Manage your main TikTok video feed",
      icon: TikTokIcon,
      status: "ACTIVE",
      ctaText: "Manage",
    },
    {
      name: "Instagram",
      description: "Connect to sync Reels",
      icon: InstagramIcon,
      status: "NOT LINKED",
      ctaText: "Connect Account",
    },
    {
      name: "YouTube",
      username: "StudioX Channel",
      description: "Import and sync your YouTube content",
      icon: YoutubeIcon,
      status: "ACTIVE",
      ctaText: "Manage",
    },
    {
      name: "X / Twitter",
      description: "Auto-post clips to X",
      icon: TwitterIcon,
      status: "NOT LINKED",
      ctaText: "Connect Account",
    },
  ];

  const walletPlatforms: PlatformItem[] = [
    {
      name: "Phantom Wallet",
      description: "Solana Network",
      icon: PhantomIcon,
      status: "NOT LINKED",
      ctaText: "Connect Phantom",
      onConnect: () => {
        setPhantomError("Phantom wallet support coming soon");
        setTimeout(() => setPhantomError(null), 4000);
      },
    },
    {
      name: "MetaMask",
      username:
        walletConnected && walletAddress
          ? truncateAddress(walletAddress)
          : undefined,
      description: "Ethereum / L2s",
      icon: MetaMaskIcon,
      status: walletConnected ? "LINKED" : "NOT LINKED",
      ctaText: walletConnecting ? "Connecting..." : "Connect MetaMask",
      onConnect: connectMetaMask,
      onDisconnect: disconnectWallet,
      isLoading: walletConnecting,
    },
  ];

  /* ================= FILTER ================= */

  const filteredSocial = useMemo(() => {
    return socialPlatforms.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const filteredWallets = useMemo(() => {
    return walletPlatforms.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const noResults =
    filteredSocial.length === 0 && filteredWallets.length === 0;

  /* ================= UI ================= */

  return (
    <div className="flex min-h-screen bg-background text-white">
      <DashboardSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1">
        {/* NAV */}
        <div className="flex justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)}>
              <Menu />
            </button>

            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full">
              <Search className="w-4 h-4" />
              <input
                type="text"
                placeholder="Search platforms..."
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearch(e.target.value)
                }
                className="bg-transparent outline-none text-sm"
              />
            </div>
          </div>

          <Bell />
        </div>

        <div className="p-10 space-y-12">
          <h1 className="text-4xl font-bold">
            Connect <span className="text-brand">Accounts</span>
          </h1>

          {noResults && (
            <p className="text-muted-foreground text-sm">
              No platforms found.
            </p>
          )}

          {filteredSocial.length > 0 && (
            <section>
              <SectionHeader title="Social Platforms" icon={Share2} />
              <div className="grid grid-cols-2 gap-4">
                {filteredSocial.map((p) => (
                  <PlatformCard key={p.name} {...p} variant="vertical" />
                ))}
              </div>
            </section>
          )}

          {filteredWallets.length > 0 && (
            <section>
              <SectionHeader title="Web3 Wallets" icon={Wallet} />
              <div className="grid grid-cols-2 gap-4">
                {filteredWallets.map((p) => (
                  <PlatformCard key={p.name} {...p} variant="horizontal" />
                ))}
              </div>
            </section>
          )}

          <HelpBanner />
          <PlatformsFooter />
        </div>
      </main>
    </div>
  );
}