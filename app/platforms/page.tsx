"use client";

import React, { useState, useMemo, useEffect } from "react";
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
import { useAuth } from "@/components/auth/AuthProvider";
import { useWallet, truncateAddress } from "@/components/wallet/WalletProvider";
import Skeleton from "@/components/ui/Skeleton";
import { useSession, signIn, signOut } from "next-auth/react";
import { useToast } from "@/hooks/useToast";

/* ================= TYPES ================= */

type PlatformItem = {
  id: string;
  name: string;
  username?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "ACTIVE" | "NOT LINKED" | "LINKED";
  ctaText: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  isLoading?: boolean;
  isComingSoon?: boolean;
};

/* ================= ICONS ================= */

import InstagramIcon from "@/components/icons/InstagramIcon";
import TikTokIcon from "@/components/icons/TikTokIcon";
import YoutubeIcon from "@/components/icons/YoutubeIcon";
import TwitterIcon from "@/components/icons/TwitterIcon";

const PhantomIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"></path>
  </svg>
);

const MetaMaskIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
  </svg>
);

/* ================= PAGE ================= */

export default function PlatformsPage() {
  const { isLoading: authLoading } = useAuth();
  const { data: session, status: sessionStatus } = useSession();
  const { showToast } = useToast();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const {
    isConnected: walletConnected,
    isConnecting: walletConnecting,
    address: walletAddress,
    error: walletError,
    connectMetaMask,
    connectPhantom,
    disconnect: disconnectWallet,
    clearError: clearWalletError,
    isRestoringSession,
  } = useWallet();

  const pageLoading = authLoading || isRestoringSession || sessionStatus === "loading";

  /* ================= HANDLERS ================= */

  const handleConnect = async (platformId: string) => {
    setConnectingId(platformId);
    try {
      await signIn(platformId, { callbackUrl: "/platforms" });
    } catch (error) {
      console.error(`Failed to connect to ${platformId}:`, error);
      showToast(`Failed to connect to ${platformId}`, "error");
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (platformId: string) => {
    try {
      await signOut({ redirect: false });
      showToast(`Disconnected from ${platformId}`, "success");
    } catch (error) {
      console.error(`Failed to disconnect from ${platformId}:`, error);
      showToast(`Failed to disconnect from ${platformId}`, "error");
    }
  };

  /* ================= DATA ================= */

  const socialPlatforms: PlatformItem[] = [
    {
      id: "tiktok",
      name: "TikTok",
      username: (session?.user as { provider?: string; name?: string })?.provider === "tiktok" ? (session?.user as { provider?: string; name?: string })?.name : undefined,
      description: "Manage your main TikTok video feed",
      icon: TikTokIcon,
      status: (session?.user as { provider?: string; name?: string })?.provider === "tiktok" ? "ACTIVE" : "NOT LINKED",
      ctaText: (session?.user as { provider?: string; name?: string })?.provider === "tiktok" ? "Manage" : "Connect Account",
      onConnect: () => handleConnect("tiktok"),
      onDisconnect: () => handleDisconnect("tiktok"),
      isLoading: connectingId === "tiktok",
    },
    {
      id: "instagram",
      name: "Instagram",
      username: (session?.user as { provider?: string; name?: string })?.provider === "instagram" ? (session?.user as { provider?: string; name?: string })?.name : undefined,
      description: "Connect to sync Reels",
      icon: InstagramIcon,
      status: (session?.user as { provider?: string; name?: string })?.provider === "instagram" ? "ACTIVE" : "NOT LINKED",
      ctaText: (session?.user as { provider?: string; name?: string })?.provider === "instagram" ? "Manage" : "Connect Account",
      onConnect: () => handleConnect("instagram"),
      onDisconnect: () => handleDisconnect("instagram"),
      isLoading: connectingId === "instagram",
    },
    {
      id: "google",
      name: "YouTube",
      username: (session?.user as { provider?: string; name?: string })?.provider === "google" ? (session?.user as { provider?: string; name?: string })?.name : undefined,
      description: "Import and sync your YouTube content",
      icon: YoutubeIcon,
      status: (session?.user as { provider?: string; name?: string })?.provider === "google" ? "ACTIVE" : "NOT LINKED",
      ctaText: (session?.user as { provider?: string; name?: string })?.provider === "google" ? "Manage" : "Connect Account",
      onConnect: () => handleConnect("google"),
      onDisconnect: () => handleDisconnect("google"),
      isLoading: connectingId === "google",
    },
    {
      id: "twitter",
      name: "X / Twitter",
      username: (session?.user as { provider?: string; name?: string })?.provider === "twitter" ? (session?.user as { provider?: string; name?: string })?.name : undefined,
      description: "Auto-post clips to X",
      icon: TwitterIcon,
      status: (session?.user as { provider?: string; name?: string })?.provider === "twitter" ? "ACTIVE" : "NOT LINKED",
      ctaText: (session?.user as { provider?: string; name?: string })?.provider === "twitter" ? "Manage" : "Connect Account",
      onConnect: () => handleConnect("twitter"),
      onDisconnect: () => handleDisconnect("twitter"),
      isLoading: connectingId === "twitter",
    },
  ];

  const walletPlatforms: PlatformItem[] = [
    {
      id: "phantom",
      name: "Phantom Wallet",
      description: "Solana Network",
      icon: PhantomIcon,
      status: "NOT LINKED",
      ctaText: "Coming Soon",
      onConnect: undefined,
      onDisconnect: undefined,
      isLoading: false,
      isComingSoon: true,
    },
    {
      id: "metamask",
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
  }, [search, socialPlatforms]);

  const filteredWallets = useMemo(() => {
    return walletPlatforms.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, walletPlatforms]);

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

          {pageLoading ? (
            <>
              <section className="space-y-4">
                <SectionHeader title="Social Platforms" icon={Share2} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-surface/40 border border-white/[0.03] rounded-[24px] p-8 flex flex-col gap-8">
                      <div className="flex items-start justify-between">
                        <Skeleton className="w-16 h-16 rounded-[22px]" />
                        <Skeleton className="w-20 h-6 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                      <Skeleton className="w-full h-12 rounded-xl" />
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <SectionHeader title="Web3 Wallets" icon={Wallet} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="bg-surface/40 border border-white/[0.03] rounded-[24px] p-6 flex items-center justify-between">
                      <div className="flex items-center gap-5">
                        <Skeleton className="w-14 h-14 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-4 w-40" />
                        </div>
                      </div>
                      <Skeleton className="w-28 h-10 rounded-xl" />
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <>
              {noResults && (
                <p className="text-muted-foreground text-sm">
                  No platforms found.
                </p>
              )}

              {filteredSocial.length > 0 && (
                <section>
                  <SectionHeader title="Social Platforms" icon={Share2} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredSocial.map((p) => (
                      <PlatformCard key={p.id} {...p} variant="vertical" />
                    ))}
                  </div>
                </section>
              )}

              {filteredWallets.length > 0 && (
                <section>
                  <SectionHeader title="Web3 Wallets" icon={Wallet} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredWallets.map((p) => (
                      <PlatformCard key={p.id} {...p} variant="horizontal" />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <HelpBanner />
          <PlatformsFooter />
        </div>
      </main>
    </div>
  );
}
