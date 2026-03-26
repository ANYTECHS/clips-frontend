"use client";

import React from "react";
// import TikTokIcon from "./icons/TikTokIcon";
// import InstagramIcon from "./icons/InstagramIcon";
// import YouTubeIcon from "./icons/YouTubeIcon";
import SocialAccountCard from "./SocialAccountCard";
import { InstagramIcon } from "./icons/InstagramIcon";
import { YouTubeIcon } from "./icons/YouTubeIcon";
import { TikTokIcon } from "./icons/TikTokIcon";

type PlatformConfig = {
  platform: "tiktok" | "instagram" | "youtube";
  label: string;
  subtext: string;
  icon: React.ReactNode;
};

const PLATFORMS: PlatformConfig[] = [
  {
    platform: "tiktok",
    label: "TikTok",
    subtext: "Connect your TikTok account",
    icon: <TikTokIcon className="h-10 w-10" aria-hidden />,
  },
  {
    platform: "instagram",
    label: "Instagram",
    subtext: "Connect your Instagram account",
    icon: <InstagramIcon className="h-10 w-10" aria-hidden />,
  },
  {
    platform: "youtube",
    label: "YouTube",
    subtext: "Connect your YouTube account",
    icon: <YouTubeIcon className="h-10 w-10" aria-hidden />,
  },
];

interface SocialAccountCardGridProps {
  onConnect: (platform: string) => void;
  selectedPlatforms?: Set<string>;
}

export default function SocialAccountCardGrid({
  onConnect,
  selectedPlatforms = new Set(),
}: SocialAccountCardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {PLATFORMS.map((config) => (
        <SocialAccountCard
          key={config.platform}
          platform={config.platform}
          label={config.label}
          subtext={config.subtext}
          icon={config.icon}
          onConnect={onConnect}
          isSelected={selectedPlatforms.has(config.platform)}
        />
      ))}
    </div>
  );
}
