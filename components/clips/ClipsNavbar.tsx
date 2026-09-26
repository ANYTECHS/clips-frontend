"use client";

import React from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Upload, User } from "lucide-react";
import { DEFAULT_BLUR_PLACEHOLDER, SIZES_AVATAR_SM } from "@/app/lib/imageUtils";

export default function ClipsNavbar() {
  const { data: session } = useSession();

  return (
    <nav className="w-full flex items-center justify-between px-6 py-4 bg-surface/50 backdrop-blur-sm border-b border-white/5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand/60 flex items-center justify-center">
          <span className="text-white font-bold text-sm">C</span>
        </div>
        <span className="text-white font-semibold text-lg">ClipCash</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-black shadow-[0_8px_24px_rgba(0,230,138,0.35)] transition hover:brightness-95"
        >
          <Upload className="h-4 w-4" />
          Upload
        </button>

        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
          {session?.user?.image ? (
            <Image
              src={session.user.image}
              alt="User avatar"
              width={40}
              height={40}
              sizes={SIZES_AVATAR_SM}
              placeholder="blur"
              blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </div>
    </nav>
  );
}
