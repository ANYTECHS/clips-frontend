"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Bell, Zap, Menu } from "lucide-react";

export default function ClipsNavbar() {
  const { user } = useAuth();
  const pathname = usePathname();

  const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || user?.email || 'Guest'}`;
  const [imgSrc, setImgSrc] = useState(defaultAvatar);

  useEffect(() => {
    setImgSrc(defaultAvatar);
  }, [user?.name, user?.email, defaultAvatar]);

  const navLinks = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Create Clips", href: "/clips" },
    // { label: "Library", href: "/library" },
    // { label: "Billing", href: "/billing" },
  ];

  return (
    <nav className="w-full border-b border-white/[0.05] bg-background/60 backdrop-blur-xl sticky top-0 z-50 px-4 sm:px-6 lg:px-12 py-4">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between">
        {/* Left: Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center text-black text-[20px] shadow-[0_0_20px_rgba(0,229,143,0.3)] group-hover:scale-105 group-hover:shadow-[0_0_30px_rgba(0,229,143,0.45)] transition-all duration-300">
            ⚡
          </div>
          <span className="text-[20px] font-black tracking-tight text-white">ClipCash</span>
        </Link>

        {/* Center: Desktop Nav */}
        <div className="hidden lg:flex items-center gap-10">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`text-[13px] font-bold uppercase tracking-wider relative py-1 transition-all duration-300 ${
                  isActive ? "text-white" : "text-muted-foreground"
                }`}
              >
                {link.label}
                {isActive && (
                  <div className="absolute -bottom-5 left-0 right-0 h-0.5 bg-brand shadow-[0_0_10px_rgba(0,229,143,0.8)]" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-5 sm:gap-7">
          <button 
            className="lg:hidden text-muted-foreground hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <button className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full border border-brand/40 text-brand text-[13px] font-bold hover:bg-brand/10 shadow-[0_0_15px_rgba(0,229,143,0.1)] hover:shadow-[0_0_25px_rgba(0,229,143,0.2)] transition-all active:scale-[0.98]">
            <Zap className="w-4 h-4 fill-brand" />
            Upgrade Pro
          </button>

          <div className="flex items-center gap-4">
            <div className="hidden md:block w-px h-8 bg-white/[0.05]" />
            <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-surface hover:border-brand/40 transition-colors cursor-pointer group relative">
              <Image 
                src={imgSrc} 
                alt={`${user?.name || user?.email || "User"} avatar`} 
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500" 
                onError={() => setImgSrc('/avatar.png')}
              />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
