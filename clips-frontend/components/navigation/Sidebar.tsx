"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React from "react";
import PlanUsage from "./PlanUsage";
import {
  useUserStore,
  selectUserName,
  selectUserEmail,
  selectUserAvatar,
  selectPlanUsage,
} from "@/app/store";

type NavItem = {
  label: string;
  href: string;
  iconSrc: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", iconSrc: "/icons/dashboard.svg" },
  { label: "Projects", href: "/projects", iconSrc: "/icons/projects.svg" },
  { label: "Earnings", href: "/earnings", iconSrc: "/icons/earnings.svg" },
  { label: "Analytics", href: "/analytics", iconSrc: "/icons/analytics.svg" },
  { label: "Platforms", href: "/platforms", iconSrc: "/icons/platforms.svg" },
  { label: "Settings", href: "/settings", iconSrc: "/icons/settings.svg" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const name = useUserStore(selectUserName);
  const email = useUserStore(selectUserEmail);
  const avatarUrl = useUserStore(selectUserAvatar);
  const planUsage = useUserStore(selectPlanUsage);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>, href: string) => {
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      router.push(href);
    }
  };

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-white/5 bg-[#0A0A0A] px-5 py-6 hidden lg:flex">
      <div className="flex items-center gap-3 px-2">
        <Image src="/logo.svg" alt="ClipCash AI logo" width={36} height={36} />
        <span className="text-lg font-semibold tracking-tight">
          ClipCash <span className="text-[#00FF9D]">AI</span>
        </span>
      </div>

      <nav className="mt-10 flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              onKeyDown={(e: React.KeyboardEvent<HTMLAnchorElement>) => handleKeyDown(e, item.href)}
              className={[
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[16px] font-medium leading-6 transition-colors",
                "text-[#94A3B8] hover:bg-[#00FF9D1A] hover:text-white",
                isActive
                  ? "border-l-2 border-[#00FF9D] bg-[#00FF9D1A] text-[#00FF9D]"
                  : "border-l-2 border-transparent",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[#94A3B8] transition-colors group-hover:text-white",
                  isActive ? "text-[#00FF9D]" : "",
                ].join(" ")}
              >
                <Image
                  src={item.iconSrc}
                  alt=""
                  width={18}
                  height={18}
                  className="h-4 w-4"
                />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <PlanUsage usage={planUsage} />

      <div className="border-t border-white/5 pt-5">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full bg-[#1F2937]">
            <Image
              src={avatarUrl ?? "/avatar.png"}
              alt={`${name} avatar`}
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{name}</p>
            <p className="truncate text-xs text-[#94A3B8]">{email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
