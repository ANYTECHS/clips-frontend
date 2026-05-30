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
import { useAuth } from "@/components/AuthProvider";
import { useWallet, truncateAddress } from "@/components/WalletProvider";
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

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
  </svg>
);

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 4s-1 1-2 1.5C19 4.5 18 4 17 4c-2 0-3 2-3 4v1C10 9 7 7 5 5c0 0-3 5 2 7-1 0-2 0-3-.5 0 2 2 4 4 4-1 .5-2 .5-3 .5 1 2 3 3 5 3 6 0 9-5 9-9v-1c1-.5 2-1.5 2-1.5z"></path>
  </svg>
);

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
  const { user, isLoading: authLoading } = useAuth();
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
      username: (session?.user as any)?.provider === "tiktok" ? (session?.user as any)?.name : undefined,
      description: "Manage your main TikTok video feed",
      icon: TikTokIcon,
      status: (session?.user as any)?.provider === "tiktok" ? "ACTIVE" : "NOT LINKED",
      ctaText: (session?.user as any)?.provider === "tiktok" ? "Manage" : "Connect Account",
      onConnect: () => handleConnect("tiktok"),
      onDisconnect: () => handleDisconnect("tiktok"),
      isLoading: connectingId === "tiktok",
    },
    {
      id: "instagram",
      name: "Instagram",
      username: (session?.user as any)?.provider === "instagram" ? (session?.user as any)?.name : undefined,
      description: "Connect to sync Reels",
      icon: InstagramIcon,
      status: (session?.user as any)?.provider === "instagram" ? "ACTIVE" : "NOT LINKED",
      ctaText: (session?.user as any)?.provider === "instagram" ? "Manage" : "Connect Account",
      onConnect: () => handleConnect("instagram"),
      onDisconnect: () => handleDisconnect("instagram"),
      isLoading: connectingId === "instagram",
    },
    {
      id: "google",
      name: "YouTube",
      username: (session?.user as any)?.provider === "google" ? (session?.user as any)?.name : undefined,
      description: "Import and sync your YouTube content",
      icon: YoutubeIcon,
      status: (session?.user as any)?.provider === "google" ? "ACTIVE" : "NOT LINKED",
      ctaText: (session?.user as any)?.provider === "google" ? "Manage" : "Connect Account",
      onConnect: () => handleConnect("google"),
      onDisconnect: () => handleDisconnect("google"),
      isLoading: connectingId === "google",
    },
    {
      id: "twitter",
      name: "X / Twitter",
      username: (session?.user as any)?.provider === "twitter" ? (session?.user as any)?.name : undefined,
      description: "Auto-post clips to X",
      icon: TwitterIcon,
      status: (session?.user as any)?.provider === "twitter" ? "ACTIVE" : "NOT LINKED",
      ctaText: (session?.user as any)?.provider === "twitter" ? "Manage" : "Connect Account",
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
                      <PlatformCard key={p.name} {...p} variant="vertical" />
                    ))}
                  </div>
                </section>
              )}

              {filteredWallets.length > 0 && (
                <section>
                  <SectionHeader title="Web3 Wallets" icon={Wallet} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredWallets.map((p) => (
                      <PlatformCard key={p.name} {...p} variant="horizontal" />
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
