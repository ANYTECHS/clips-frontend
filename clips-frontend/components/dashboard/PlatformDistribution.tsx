"use client";

import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import ProgressBar from "@/components/ui/ProgressBar";

// ─── Icons ────────────────────────────────────────────────────────────────────

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const OtherIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

// ─── Data ─────────────────────────────────────────────────────────────────────

interface Platform {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  percentage: number;
  color: string;
  iconColor: string;
  bgColor: string;
}

const platforms: Platform[] = [
  {
    name: "TikTok Shorts",
    icon: TikTokIcon,
    percentage: 38,
    color: "var(--color-tiktok)",
    iconColor: "text-tiktok",
    bgColor: "rgba(238, 29, 82, 0.15)",
  },
  {
    name: "YouTube Shorts",
    icon: YoutubeIcon,
    percentage: 31,
    color: "var(--color-youtube)",
    iconColor: "text-youtube",
    bgColor: "rgba(255, 0, 0, 0.15)",
  },
  {
    name: "Instagram Reels",
    icon: InstagramIcon,
    percentage: 22,
    color: "var(--color-instagram)",
    iconColor: "text-instagram",
    bgColor: "rgba(225, 48, 108, 0.15)",
  },
  {
    name: "Other",
    icon: OtherIcon,
    percentage: 9,
    color: "var(--color-muted)",
    iconColor: "text-muted",
    bgColor: "rgba(142, 152, 149, 0.1)",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlatformDistribution() {
  // Animate bars in on mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const total = platforms.reduce((sum, p) => sum + p.percentage, 0);

  return (
    <section
      aria-label="Platform contribution distribution"
      className="bg-surface border border-border rounded-[24px] p-8 flex flex-col gap-7"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[18px] font-bold text-white tracking-tight">Distribution</h3>
        <span className="text-[12px] text-muted font-medium">{total}% total</span>
      </div>

      {/* Stacked overview bar */}
      <div
        className="flex w-full h-2.5 rounded-full overflow-hidden gap-px"
        role="img"
        aria-label="Combined platform distribution bar"
      >
        {platforms.map((p) => (
          <div
            key={p.name}
            className="h-full transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full"
            style={{
              width: mounted ? `${p.percentage}%` : "0%",
              backgroundColor: p.color,
            }}
            title={`${p.name}: ${p.percentage}%`}
          />
        ))}
      </div>

      {/* Platform rows */}
      <ul className="space-y-5" role="list">
        {platforms.map((p) => (
          <li key={p.name}>
            <div className="flex items-center justify-between mb-2">
              {/* Icon + name */}
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/[0.04] shrink-0"
                  style={{ backgroundColor: p.bgColor }}
                >
                  <p.icon className={`w-4.5 h-4.5 ${p.iconColor}`} />
                </div>
                <span className="text-[13px] font-medium text-white">{p.name}</span>
              </div>

              {/* Percentage */}
              <span
                className="text-[13px] font-bold tabular-nums"
                style={{ color: p.color }}
                aria-hidden="true"
              >
                {p.percentage}%
              </span>
            </div>

            {/* Progress bar */}
            <ProgressBar
              value={mounted ? p.percentage : 0}
              color={p.color}
              label={p.name}
              height="sm"
            />
          </li>
        ))}
      </ul>

      {/* Footer */}
      <button
        className="w-full py-3 rounded-xl border border-white/5 text-[13px] font-bold text-muted hover:text-white hover:bg-white/[0.03] transition-all flex items-center justify-center gap-2 mt-1"
        aria-label="Connect a new platform"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        Connect New Platform
      </button>
    </section>
  );
}
