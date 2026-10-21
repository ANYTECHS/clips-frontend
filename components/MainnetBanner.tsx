"use client";

import { AlertTriangle } from "lucide-react";

import { useOptionalNetworkContext } from "@/app/context/NetworkContext";

export const MAINNET_BANNER_TEXT = "You are on Mainnet — real funds in use";

/**
 * Persistent, non-dismissible banner rendered on every page while the
 * active Stellar network is mainnet.
 */
export function MainnetBanner() {
  const isMainnet = useOptionalNetworkContext()?.isMainnet ?? false;
  if (!isMainnet) return null;

  return (
    <div
      role="status"
      data-testid="mainnet-banner"
      className="sticky top-0 z-[90] w-full bg-amber-500 text-black text-[12px] font-bold flex items-center justify-center gap-2 px-4 py-1.5"
    >
      <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
      {MAINNET_BANNER_TEXT}
    </div>
  );
}
