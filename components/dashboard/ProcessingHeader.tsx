"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import Logo from "@/components/shared/Logo";
import UserAvatar from "@/components/shared/UserAvatar";

export default function ProcessingHeader() {
  const { user } = useAuth();

  return (
    <header className="w-full flex items-center justify-between px-6 py-5 bg-transparent border-b border-[#0e4d2a] relative z-50">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
        <Logo variant="simple" size={32} />
        <span className="text-[#B6FF4A] font-extrabold text-xl tracking-tight">enclips</span>
      </Link>

      {/* Nav */}
      <nav className="hidden md:flex items-center gap-8">
        <Link href="/dashboard" className="text-[#90A89C] hover:text-[#F4F7EF] transition-colors text-sm font-medium">
          Dashboard
        </Link>
        <Link href="/clips" className="text-[#90A89C] hover:text-[#F4F7EF] transition-colors text-sm font-medium">
          My Clips
        </Link>
        <Link href="/projects" className="text-[#90A89C] hover:text-[#F4F7EF] transition-colors text-sm font-medium">
          Projects
        </Link>
      </nav>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <UserAvatar user={user} size="sm" />
      </div>
    </header>
  );
}
