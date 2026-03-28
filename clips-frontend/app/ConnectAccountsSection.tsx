"use client";

import { useState } from "react";
import PlatformManageModal from "./components/PlatformManageModal";
import { Badge } from "@/components/ui/Badge";

type Platform = {
  name: string;
  handle: string;
  connected: boolean;
  color: string;
  textColor: string;
  icon: string;
};

const PLATFORMS: Platform[] = [
  { name: "TikTok", handle: "@yourchannel", connected: true, color: "#010101", textColor: "#fff", icon: "TT" },
  { name: "YouTube", handle: "Your Channel", connected: true, color: "#FF0000", textColor: "#fff", icon: "YT" },
  { name: "Instagram", handle: "Not connected", connected: false, color: "#E1306C", textColor: "#fff", icon: "IG" },
  { name: "LinkedIn", handle: "Not connected", connected: false, color: "#0A66C2", textColor: "#fff", icon: "LI" },
  { name: "Snapchat", handle: "Not connected", connected: false, color: "#FFFC00", textColor: "#000", icon: "SC" },
  { name: "Pinterest", handle: "Not connected", connected: false, color: "#E60023", textColor: "#fff", icon: "PT" },
];

export default function ConnectAccountsSection() {
  const [platforms, setPlatforms] = useState(PLATFORMS);
  const [managePlatform, setManagePlatform] = useState<Platform | null>(null);

  const toggle = (name: string) => {
    setPlatforms((prev) =>
      prev.map((p) => (p.name === name ? { ...p, connected: !p.connected } : p))
    );
  };

  const disconnect = (name: string) => {
    setPlatforms((prev) =>
      prev.map((p) =>
        p.name === name
          ? { ...p, connected: false, handle: "Not connected" }
          : p
      )
    );
  };

  return (
    <>
      <div
        className="w-full max-w-xl rounded-2xl p-6"
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
              Connected Platforms
            </h2>
            <p className="text-xs text-white/35 mt-0.5">
              {platforms.filter((p) => p.connected).length} of {platforms.length} connected
            </p>
          </div>
          <button
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer"
            style={{ background: "rgba(34,197,94,0.1)", color: "#22C55E" }}
          >
            Manage
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {platforms.map((p) => (
            <li
              key={p.name}
              className="flex items-center gap-3 p-3 rounded-xl transition-all duration-150"
              style={{ background: "rgba(255,255,255,0.025)" }}
            >
              {/* Icon */}
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: p.color, color: p.textColor }}
              >
                {p.icon}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white/80">{p.name}</p>
                  <p className="text-xs text-white/30 truncate">{p.handle}</p>
                </div>
                <Badge variant={p.connected ? "active" : "not-linked"}>
                  {p.connected ? "Active" : "Not Linked"}
                </Badge>
              </div>

              {/* Manage button for connected, Connect for disconnected */}
              {p.connected ? (
                <button
                  onClick={() => setManagePlatform(p)}
                  className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer"
                  style={{ background: "rgba(34,197,94,0.1)", color: "#22C55E" }}
                >
                  Manage
                </button>
              ) : (
                <button
                  onClick={() => toggle(p.name)}
                  className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                >
                  Connect
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Platform Manage Modal (#96) */}
      {managePlatform && (
        <PlatformManageModal
          platform={managePlatform}
          onClose={() => setManagePlatform(null)}
          onSyncNow={() => {
            // Sync logic placeholder
          }}
          onDisconnect={() => disconnect(managePlatform.name)}
        />
      )}
    </>
  );
}
