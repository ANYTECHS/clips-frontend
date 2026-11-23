"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Video, Wallet, Coins, Settings } from "lucide-react";

/** Issue #1241 — the five most-used dashboard routes. */
const bottomNavItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "clips",     label: "Clips",     icon: Video,           href: "/projects" },
  { id: "wallet",    label: "Wallet",    icon: Wallet,          href: "/wallet" },
  { id: "earnings",  label: "Earnings",  icon: Coins,           href: "/earnings" },
  { id: "settings",  label: "Settings",  icon: Settings,        href: "/settings" },
];

/**
 * Fixed bottom tab bar shown below 768px (md). Each tab is at least 44×44px
 * (WCAG 2.5.5) and respects the iOS home-indicator safe area.
 */
export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#0e4d2a] bg-[#031d0f]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 min-h-14 min-w-11 px-1 text-[10px] font-bold transition-colors ${
                  isActive ? "text-[#B6FF4A]" : "text-[#90A89C] hover:text-[#F4F7EF]"
                }`}
              >
                <item.icon className="w-5 h-5" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
