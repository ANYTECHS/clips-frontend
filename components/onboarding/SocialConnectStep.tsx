import React, { useState } from "react";
import { MonitorPlay, Loader2 } from "lucide-react";
import { InstagramIcon, YoutubeIcon } from "@/components/shared/Icons";
import apiClient from "@/lib/apiClient";

interface SocialConnectStepProps {
  onComplete: () => void;
}

export default function SocialConnectStep({ onComplete }: SocialConnectStepProps) {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const platforms = [
    {
      id: "tiktok",
      name: "TikTok",
      icon: <MonitorPlay className="w-[38px] h-[38px]" />,
      desc: "Short-form mastery",
      iconBg: "bg-black",
    },
    {
      id: "instagram",
      name: "Instagram",
      icon: <InstagramIcon className="w-[38px] h-[38px]" />,
      desc: "Reels & Engagement",
      iconBg: "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]",
    },
    {
      id: "youtube",
      name: "YouTube",
      icon: <YoutubeIcon className="w-[38px] h-[38px]" />,
      desc: "Long-form & Shorts",
      iconBg: "bg-[#FF0000]",
    },
  ];

  const handleConnect = async (platformId: string) => {
    setConnecting(platformId);
    setConnectError(null);
    try {
      const response = await apiClient.get(`/platforms/connect/${platformId}`);
      const { url } = response.data;
      if (url) {
        window.location.href = url;
      }
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 500) {
        setConnectError(
          "Platform connection is temporarily unavailable. Please skip for now and try again from the Platforms page."
        );
      } else {
        setConnectError(`Failed to connect to ${platformId}. Please try again.`);
      }
      console.error(`Failed to connect to ${platformId}:`, error);
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center">
      <div className="text-center mb-5">
        <h2 className="text-[32px] font-bold tracking-tight text-[#F4F7EF] mb-3">
          Step 2: Connect your first social account
        </h2>
        <p className="text-[#90A89C] text-[14px]">
          Connect to start importing your content automatically.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-center items-center gap-6 max-w-4xl mx-auto w-full px-4">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            disabled={connecting !== null}
            onClick={() => handleConnect(platform.id)}
            className="w-full sm:w-[260px] bg-[#06351C] backdrop-blur-md rounded-[20px] p-[40px] flex flex-col items-center justify-center gap-1 border border-[#0e4d2a] hover:border-[#39FF14]/40 transition-all transform hover:-translate-y-1 shadow-[0_10px_30px_rgba(0,0,0,0.5)] group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div
              className={`w-[80px] h-[80px] rounded-[24px] flex items-center justify-center text-white ${platform.iconBg} shadow-lg group-hover:scale-105 transition-transform`}
            >
              {connecting === platform.id ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                platform.icon
              )}
            </div>
            <div className="text-center mt-1">
              <div className="font-bold text-[18px] text-[#F4F7EF]">{platform.name}</div>
              <div className="text-[#90A89C] text-[13px] mt-1">{platform.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-center mt-[20px]">
        <button
          onClick={onComplete}
          disabled={connecting !== null}
          className="px-8 py-3.5 rounded-[12px] border border-[#0e4d2a] text-[#90A89C] hover:text-[#F4F7EF] hover:bg-[#042413] transition-all text-[14px] font-medium active:scale-95 disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>

      {connectError && (
        <p className="text-center text-red-400 text-[13px] mt-4 max-w-md mx-auto">
          {connectError}
        </p>
      )}
    </div>
  );
}
