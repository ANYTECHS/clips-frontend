"use client";

import { Wifi, WifiOff, RefreshCw } from "lucide-react";

type Props = {
  state: "connecting" | "connected" | "reconnecting" | "offline";
};

export default function ConnectionStatus({ state }: Props) {
  const label =
    state === "connected"
      ? "Connected"
      : state === "reconnecting"
        ? "Reconnecting..."
        : state === "offline"
          ? "Offline"
          : "Connecting...";

  const icon =
    state === "connected" ? (
      <Wifi className="h-4 w-4 text-emerald-500" />
    ) : state === "offline" ? (
      <WifiOff className="h-4 w-4 text-red-500" />
    ) : (
      <RefreshCw className="h-4 w-4 text-amber-500 animate-spin" />
    );

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200">
      {icon}
      <span>{label}</span>
    </div>
  );
}
