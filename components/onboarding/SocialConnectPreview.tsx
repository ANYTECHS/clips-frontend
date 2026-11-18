import React from "react";
import { Link2 } from "lucide-react";

export default function SocialConnectPreview() {
  return (
    <div className="bg-[#06351C]/60 backdrop-blur-md rounded-[20px] p-[38px] border border-[#0e4d2a] opacity-70 saturate-50 pointer-events-none">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-[8px] bg-[#042413] border border-[#0e4d2a] text-[#90A89C] flex items-center justify-center">
          <Link2 className="w-5 h-5" />
        </div>
        <h2 className="text-[18px] font-bold text-[#90A89C] tracking-tight">Connect Social Accounts</h2>
      </div>

      <div className="space-y-3">
        {["TikTok", "Instagram", "YouTube"].map((name, i) => (
          <div
            key={i}
            className="w-full bg-[#042413] border border-[#0e4d2a] rounded-[12px] px-4 py-3.5 flex items-center gap-3"
          >
            <div className="w-[22px] h-[22px] rounded-full bg-[#06351C] text-[#90A89C] flex items-center justify-center">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <span className="text-[#90A89C] text-[14px] font-medium">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
