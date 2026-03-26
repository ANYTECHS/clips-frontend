"use client";

import React from "react";
import { Check } from "lucide-react";

interface SocialAccountCardProps {
  platform: "tiktok" | "instagram" | "youtube";
  label: string;
  subtext: string;
  icon?: React.ReactNode;
  onConnect: (platform: string) => void;
  isSelected?: boolean;
}

export default function SocialAccountCard({
  platform,
  label,
  subtext,
  icon,
  onConnect,
  isSelected = false,
}: SocialAccountCardProps) {
  const handleClick = () => {
    onConnect(platform);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onConnect(platform);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${isSelected ? "Deselect" : "Select"} ${label} account`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`relative rounded-2xl backdrop-blur-xl p-4 sm:p-6 flex flex-col items-center gap-4 cursor-pointer select-none border transition-all duration-200 ease-in-out ${
        isSelected
          ? "bg-white/10 border-white/30 dark:bg-zinc-800/70 dark:border-zinc-600"
          : "bg-white/90 dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      }`}
    >
      {isSelected && (
        <div className="absolute top-3 right-3 bg-green-500 rounded-full p-1">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}
      <div className="flex items-center justify-center">
        {icon ?? <span className="text-lg font-semibold">{label}</span>}
      </div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {label}
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
        {subtext}
      </p>
    </div>
  );
}
