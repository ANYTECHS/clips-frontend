"use client";

import { useEffect, useState } from "react";
import { YouTubeIcon } from "@/components/icons/YouTubeIcon";
import { TikTokIcon } from "@/components/icons/TikTokIcon";
import { InstagramIcon } from "@/components/icons/InstagramIcon";

const PLATFORMS = [
  {
    name: "YouTube Shorts",
    key: "youtube",
    percentage: 45,
    color: "#FF0000",
    icon: YouTubeIcon,
  },
  {
    name: "TikTok",
    key: "tiktok",
    percentage: 35,
    color: "#EE1D52",
    icon: TikTokIcon,
  },
  {
    name: "IG Reels",
    key: "instagram",
    percentage: 20,
    color: "#285AEB",
    icon: InstagramIcon,
  },
] as const;

export default function PlatformDistribution() {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // Trigger animation on mount after a brief delay for visibility
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Platform rows */}
      <div className="flex flex-col gap-3">
        {PLATFORMS.map(({ name, key, percentage, color, icon: Icon }) => (
          <div key={key} className="flex flex-col gap-1.5">
            {/* Label row: icon + name + percentage */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                <span className="text-sm text-zinc-300">{name}</span>
              </div>
              <span className="text-sm font-semibold text-white tabular-nums">
                {percentage}%
              </span>
            </div>

            {/* Progress bar */}
            <div
              className="h-2 w-full rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.07)" }}
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${name} ${percentage}%`}
            >
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: animated ? `${percentage}%` : "0%",
                  background: color,
                  boxShadow: `0 0 8px ${color}66`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Connect New Platform button */}
      <button
        type="button"
        className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M7 1v12M1 7h12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Connect New Platform
      </button>
    </div>
  );
}
