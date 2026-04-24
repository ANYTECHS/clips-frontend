"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Video,
  Share2,
  DollarSign,
  Search,
  Bell,
  Wallet,
  X,
  Zap,
  ArrowUpRight,
  Menu,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { EarningsSearchProvider, useEarningsSearch } from "@/app/lib/EarningsSearchContext";

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "projects", label: "Projects", icon: Video, href: "/projects" },
  { id: "platforms", label: "Platforms", icon: Share2, href: "/platforms" },
  { id: "earnings", label: "Earnings", icon: DollarSign, href: "/earnings" },
];

// ─── Sidebar ────────────────────────────────────────────────────────────────

function EarningsSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-[#050505] border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 shrink-0 h-screen sticky top-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Logo & Close */}
      <div className="p-8 flex items-center justify-between">
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex items-center gap-3 text-[20px] font-extrabold tracking-tight text-white group"
        >
          <div className="w-[32px] h-[32px] bg-brand rounded-[10px] flex items-center justify-center text-black text-[18px] group-hover:scale-110 transition-transform">
            ⚡
          </div>
          <span>
            ClipCash <span className="text-brand">AI</span>
          </span>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden p-2 text-[#5A6F65] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? "bg-brand/10 text-brand font-bold"
                  : "text-[#8e9895] hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              <item.icon
                className={`w-5 h-5 ${
                  isActive
                    ? "text-brand"
                    : "text-[#4A5D54] group-hover:text-white"
                }`}
              />
              <span className="text-[14px]">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_8px_rgba(0,229,143,0.8)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Pro Plan Card */}
      <div className="px-6 mb-6">
        <div className="bg-[#0C120F] border border-[#1A2621] rounded-[20px] p-5 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-brand/10 blur-[40px] rounded-full pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-[10px] font-bold text-brand uppercase tracking-wider mb-1">
                PRO PLAN
              </div>
              <div className="text-[14px] font-bold text-white">80% used</div>
            </div>
            <Zap className="w-4 h-4 text-brand fill-brand" />
          </div>
          <div className="w-full h-1.5 bg-[#17201C] rounded-full mb-5 overflow-hidden">
            <div
              className="h-full bg-brand rounded-full shadow-[0_0_10px_rgba(0,229,143,0.5)]"
              style={{ width: "80%" }}
            />
          </div>
          <button className="w-full bg-brand hover:bg-brand-hover text-black py-2.5 rounded-xl font-bold text-[13px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]">
            Upgrade Now
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* User Info */}
      <div className="p-6 border-t border-white/5 bg-[#080C0B]/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-zinc-800">
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${
                user?.name || user?.email || "Guest"
              }`}
              alt={`${user?.profile?.username || user?.name || "User"} avatar`}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-white truncate">
              {user?.profile?.username || user?.name || "Alex Rivera"}
            </div>
            <div className="text-[11px] text-[#5A6F65] truncate">
              {user?.email || "alex@clipcash.ai"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function EarningsHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { searchQuery, setSearchQuery } = useEarningsSearch();

  return (
    <header className="flex items-center justify-between py-5 px-4 sm:px-6 lg:px-10 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-30">
      {/* Left: hamburger + search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-[#8e9895] hover:text-white transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5D54] pointer-events-none" />
          <input
            id="earnings-search"
            type="text"
            placeholder="Search transactions, payouts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111111] border border-white/5 rounded-xl pl-10 pr-10 py-2.5 text-[14px] text-white placeholder:text-[#4A5D54] focus:outline-none focus:border-brand/30 focus:bg-[#111111] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5D54] hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3 ml-4">
        {/* Notifications */}
        <button
          className="w-10 h-10 rounded-xl bg-[#111111] border border-white/5 flex items-center justify-center text-[#8e9895] hover:text-white transition-colors relative shrink-0"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-brand rounded-full border-2 border-[#111111]" />
        </button>

        {/* Wallet Connect */}
        <button className="bg-brand hover:bg-brand-hover text-black px-4 sm:px-5 py-2.5 rounded-xl font-bold text-[13px] sm:text-[14px] flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(0,229,143,0.15)] hover:shadow-[0_0_30px_rgba(0,229,143,0.25)] active:scale-[0.97] shrink-0">
          <Wallet className="w-4 h-4" />
          <span className="hidden sm:inline">Connect Wallet</span>
          <span className="sm:hidden">Wallet</span>
        </button>
      </div>
    </header>
  );
}

// ─── Layout Wrapper ──────────────────────────────────────────────────────────

interface EarningsLayoutProps {
  children: React.ReactNode;
}

export default function EarningsLayout({ children }: EarningsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <EarningsSearchProvider>
      <div className="flex min-h-screen bg-[#050505] text-white font-sans overflow-hidden">
        {/* Ambient glows */}
        <div className="fixed top-0 left-0 w-[50vw] h-[50vw] rounded-full bg-brand/5 blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
        <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.03] rounded-full blur-[100px] pointer-events-none translate-x-1/3" />

        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <EarningsSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 flex flex-col h-screen overflow-y-auto relative z-10">
          <EarningsHeader onMenuClick={() => setSidebarOpen(true)} />

          <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </EarningsSearchProvider>
  );
}
