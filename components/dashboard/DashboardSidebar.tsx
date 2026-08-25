"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { memo, useCallback } from "react";
import {
  LayoutDashboard,
  Video,
  DollarSign,
  Layers,
  Wallet,
  Activity,
  Settings,
  Shield,
  X,
  Zap,
  Share2,
  BarChart3,
  CreditCard,
} from "lucide-react";
import PlanUsage from "@/components/dashboard/PlanUsage";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: Video },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Earnings", href: "/earnings", icon: DollarSign },
  { label: "Referral", href: "/referral", icon: Share2 },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Vault", href: "/vault", icon: Layers },
  { label: "Wallet", href: "/wallet", icon: Wallet },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Multisig", href: "/multisig", icon: Shield },
];

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * DashboardSidebar — main navigation sidebar.
 *
 * Wrapped in React.memo so it only re-renders when `isOpen` or `pathname`
 * actually changes. The `isActive` helper is stabilised with useCallback.
 *
 * Issue #874 – memoization for expensive computations.
 */
const DashboardSidebar = memo(function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const pathname = usePathname();

  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(href + "/"),
    [pathname]
  );

  return (
    <>
      {/* Sidebar panel */}
      <aside
        className={[
          // Base layout
          "fixed lg:sticky top-0 left-0 z-50",
          "flex flex-col h-screen w-64 shrink-0",
          // Surface
          "bg-surface border-r border-border",
          // Mobile: slide in/out
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
        aria-label="Sidebar navigation"
      >
        {/* Logo / branding */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-border shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 group"
            onClick={onClose}
            aria-label="Go to dashboard home"
          >
            <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center shadow-[0_4px_12px_rgba(0,229,143,0.4)] group-hover:brightness-110 transition-all">
              <Zap className="w-4 h-4 text-black" aria-hidden="true" />
            </div>
            <span className="text-[15px] font-black text-white tracking-tight">
              Clips<span className="text-brand">AI</span>
            </span>
          </Link>

          {/* Close button — mobile only */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface-hover transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Primary nav */}
        <nav
          className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-0.5"
          aria-label="Main navigation"
        >
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={[
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  active
                    ? "bg-brand/10 text-brand border border-brand/20"
                    : "text-muted hover:text-white hover:bg-surface-hover border border-transparent",
                ].join(" ")}
              >
                <Icon
                  className={[
                    "w-4 h-4 shrink-0 transition-colors",
                    active ? "text-brand" : "text-muted group-hover:text-white",
                  ].join(" ")}
                  aria-hidden="true"
                />
                {label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand shrink-0" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Live Plan Usage Widget */}
        <div className="px-3 py-2 shrink-0">
          <PlanUsage />
        </div>

        {/* Bottom nav (settings) */}
        <div className="px-3 pb-5 space-y-0.5 border-t border-border pt-3 shrink-0">
          {BOTTOM_NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={[
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  active
                    ? "bg-brand/10 text-brand border border-brand/20"
                    : "text-muted hover:text-white hover:bg-surface-hover border border-transparent",
                ].join(" ")}
              >
                <Icon
                  className={[
                    "w-4 h-4 shrink-0 transition-colors",
                    active ? "text-brand" : "text-muted group-hover:text-white",
                  ].join(" ")}
                  aria-hidden="true"
                />
                {label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand shrink-0" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
});

export default DashboardSidebar;
