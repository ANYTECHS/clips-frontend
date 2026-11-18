"use client";

import React, { useState } from "react";
import { LucideIcon, CheckCircle2, Settings, Loader2, Unlink } from "lucide-react";
import apiClient from "@/lib/apiClient";

interface PlatformCardProps {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }> | LucideIcon;
  status: "ACTIVE" | "NOT LINKED" | "LINKED";
  ctaText: string;
  username?: string;
  variant?: "vertical" | "horizontal";
  onDisconnected?: (platformKey: string) => void;
}

export default function PlatformCard({ name, description, icon: Icon, status, ctaText: _ctaText, username, variant = "vertical", onDisconnected }: PlatformCardProps) {
  const [_loading, _setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const isActive = status === "ACTIVE" || status === "LINKED";

  const platformKey = name.toLowerCase().split(" / ")[0].replace(/\s+/g, "");

  const handleDisconnect = async () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    setDisconnecting(true);
    setConfirmDisconnect(false);
    setConnectError(null);
    try {
      const response = await apiClient.delete(`/platforms/${platformKey.toUpperCase()}`);
      console.log(`[PlatformCard] DELETE /platforms/${platformKey.toUpperCase()} →`, response.status, response.data);
      onDisconnected?.(platformKey);
    } catch (error: any) {
      const httpStatus = error?.response?.status;
      const backendMessage = error?.response?.data?.message ?? error?.response?.data?.error ?? null;
      console.error(`[PlatformCard] DELETE /platforms/${platformKey.toUpperCase()} → ${httpStatus}`, backendMessage ?? error);
      if (httpStatus === 404) {
        onDisconnected?.(platformKey);
      } else {
        setConnectError(backendMessage ?? "Failed to disconnect. Please try again.");
      }
    } finally {
      setDisconnecting(false);
    }
  };

  if (variant === "horizontal") {
    return (
      <div className="flex flex-col gap-2">
        <div className="bg-[#06351C] border border-[#0e4d2a] rounded-[24px] p-6 flex items-center justify-between group hover:border-[#39FF14]/40 hover:shadow-[0_0_30px_rgba(57,255,20,0.12)] transition-all duration-300 relative overflow-hidden">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#90A89C] group-hover:text-[#B6FF4A] transition-colors">
              <Icon className="w-7 h-7" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h4 className="text-[17px] font-bold text-[#F4F7EF] tracking-tight">{name}</h4>
              <p className="text-[13px] text-[#90A89C] font-medium">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isActive ? (
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#B6FF4A] uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {status}
                </div>
                {username && (
                  <div className="text-[13px] font-mono text-[#90A89C] bg-[#042413] px-2 py-0.5 rounded-lg border border-[#0e4d2a]">
                    {username}
                  </div>
                )}
                {confirmDisconnect ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-red-400 font-medium">Disconnect?</span>
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-bold hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmDisconnect(false)}
                      className="px-3 py-1 rounded-lg border border-[#0e4d2a] text-[#90A89C] text-[11px] font-bold hover:text-[#F4F7EF] transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="flex items-center gap-1.5 text-[11px] text-[#90A89C] hover:text-red-400 transition-colors font-medium border border-[#0e4d2a] hover:border-red-400/30 px-3 py-1.5 rounded-xl disabled:opacity-50"
                  >
                    <Unlink className="w-3 h-3" />
                    Disconnect
                  </button>
                )}
              </div>
            ) : (
              <button
                disabled
                className="px-6 py-2.5 rounded-xl border border-[#0e4d2a] bg-[#042413] text-[#90A89C] font-bold text-[13px] cursor-not-allowed select-none"
              >
                Coming Soon
              </button>
            )}
          </div>
        </div>
        {connectError && (
          <p className="text-red-400 text-[12px] text-center px-2">{connectError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-[#06351C] border border-[#0e4d2a] rounded-[24px] p-8 flex flex-col gap-8 group hover:border-[#39FF14]/40 hover:shadow-[0_0_30px_rgba(57,255,20,0.12)] transition-all duration-300 relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="w-16 h-16 rounded-[22px] bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#90A89C] group-hover:text-[#B6FF4A] transition-all duration-500 shadow-inner">
            <Icon className="w-8 h-8" />
          </div>
          <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.12em] ${
            isActive
              ? "bg-[#B6FF4A]/12 text-[#B6FF4A] border border-[#B6FF4A]/25 shadow-[0_0_10px_rgba(57,255,20,0.15)]"
              : "bg-[#042413] text-[#90A89C] border border-[#0e4d2a]"
          }`}>
            {status}
          </div>
        </div>

        <div className="space-y-1">
          <h4 className="text-[20px] font-bold text-[#F4F7EF] tracking-tight">{name}</h4>
          <p className="text-[14px] text-[#90A89C] font-medium leading-relaxed">{username || description}</p>
        </div>

        {/* Primary CTA */}
        {!isActive ? (
          <button
            disabled
            className="w-full py-4 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2.5 bg-[#042413] border border-[#0e4d2a] text-[#90A89C] cursor-not-allowed select-none transition-none"
          >
            Coming Soon
          </button>
        ) : confirmDisconnect ? (
          <div className="flex flex-col gap-2">
            <p className="text-[12px] text-red-400 text-center font-medium">
              Disconnect {name}? This will stop auto-posting.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex-1 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-[13px] hover:bg-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmDisconnect(false)}
                className="flex-1 py-3 rounded-xl border border-[#0e4d2a] text-[#90A89C] font-bold text-[13px] hover:text-[#F4F7EF] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex-1 py-3.5 rounded-xl font-bold text-[13px] transition-all flex items-center justify-center gap-2 bg-[#042413] border border-[#0e4d2a] text-[#90A89C] hover:text-red-400 hover:border-red-400/20 active:scale-[0.98] disabled:opacity-50"
            >
              <Unlink className="w-4 h-4" />
              Disconnect
            </button>
            <button
              className="flex-1 py-3.5 rounded-xl font-bold text-[13px] transition-all flex items-center justify-center gap-2 bg-[#042413] border border-[#0e4d2a] text-[#F4F7EF] hover:bg-[#084223] active:scale-[0.98]"
            >
              <Settings className="w-4 h-4 text-[#90A89C]" />
              Manage
            </button>
          </div>
        )}
      </div>
      {connectError && (
        <p className="text-red-400 text-[12px] text-center px-2">{connectError}</p>
      )}
    </div>
  );
}
