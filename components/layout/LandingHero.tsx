"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Loader2, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface LandingHeroProps {
  /**
   * Badge text displayed at the top
   * Default: "AI CLIPPING V2.0 IS LIVE"
   */
  badgeText?: string;

  /**
   * Main heading (h1)
   * Default: "Turn 1 long video into 100+ viral clips"
   */
  heading?: React.ReactNode;

  /**
   * Description paragraph
   * Default: "Preview, pick, post & mint — our AI-powered engine finds the high-retention moments..."
   */
  description?: string;

  /**
   * Show URL input form
   * Default: true
   */
  showUrlForm?: boolean;

  /**
   * Show social proof section (avatars + text)
   * Default: true
   */
  showSocialProof?: boolean;

  /**
   * Custom className
   */
  className?: string;
}

export default function LandingHero({
  badgeText = "AI CLIPPING V2.0 IS LIVE",
  heading,
  description = "Preview, pick, post & mint — our AI-powered engine finds the high-retention moments for your viral growth across TikTok, Reels, and Shorts.",
  showUrlForm = true,
  showSocialProof = true,
  className = "",
}: LandingHeroProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [urlAnalyzing, setUrlAnalyzing] = useState(false);

  const defaultHeading = (
    <>
      Turn 1 long<br />
      video into <span className="text-brand">100+</span>
      <br />
      <span className="text-brand">viral clips</span>
    </>
  );

  const handleURLSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setUrlAnalyzing(true);
    await new Promise((r) => setTimeout(r, 1500));
    setUrlAnalyzing(false);
    const emailInput = document.getElementById("auth-email") as HTMLInputElement;
    if (emailInput) {
      emailInput.focus();
    } else {
      router.push("/signup");
    }
  };

  return (
    <div className={`space-y-8 max-w-[580px] ${className}`}>
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/[0.12] border border-brand/20 text-brand text-[11px] font-bold tracking-[0.1em] uppercase">
        <span className="w-2 h-2 rounded-full bg-brand" style={{ boxShadow: "0 0 10px var(--color-brand)" }} />
        {badgeText}
      </div>

      {/* Heading */}
      <h1 className="text-[64px] font-extrabold leading-[1.05] tracking-tight">
        {heading ?? defaultHeading}
      </h1>

      {/* Description */}
      <p className="text-muted text-lg max-w-[500px] leading-[1.6]">
        {description}
      </p>

      {/* URL Form */}
      {showUrlForm && (
        <form onSubmit={handleURLSubmit} className="flex gap-4 w-full">
          <div className="relative flex-1 max-w-[340px] group">
            <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted group-focus-within:text-brand transition-colors" />
            <input
              type="url"
              placeholder="Paste YouTube or Vimeo URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-input/60 border border-subtle rounded-[14px] py-3.5 pl-12 pr-4 text-white placeholder-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus:border-brand/50 focus:bg-input transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={urlAnalyzing}
            className="bg-brand hover:bg-brand-hover text-black px-8 py-3.5 rounded-[14px] font-bold text-sm tracking-wide transition-all disabled:opacity-70 flex items-center justify-center gap-2 min-w-[130px] shadow-[0_0_15px_rgba(0,229,143,0.2)]"
          >
            {urlAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Analyzing
              </>
            ) : (
              "Clip Now"
            )}
          </button>
        </form>
      )}

      {/* Social Proof */}
      {showSocialProof && (
        <div className="flex items-center gap-4 text-sm text-muted pt-2">
          <div className="flex -space-x-2.5">
            <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-800 flex items-center justify-center text-[10px] overflow-hidden">
              <Image
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                alt="Avatar for Felix"
                width={36}
                height={36}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-700 flex items-center justify-center text-[10px] overflow-hidden">
              <Image
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka"
                alt="Avatar for Aneka"
                width={36}
                height={36}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-600 flex items-center justify-center text-[10px] overflow-hidden">
              <Image
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jocelyn"
                alt="Avatar for Jocelyn"
                width={36}
                height={36}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          Joined by 10,000+ creators this month
        </div>
      )}
    </div>
  );
}
