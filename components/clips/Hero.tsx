"use client";

import React from "react";

export default function Hero() {
  return (
    <div className="text-center space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-top-10 duration-1000 ease-out">
      <h1 className="text-[36px] sm:text-[48px] font-black tracking-tight text-[#F4F7EF] leading-[1.1] max-w-3xl mx-auto">
        Turn Long Videos into{" "}
        <span className="text-[#B6FF4A] inline-block drop-shadow-[0_0_15px_rgba(57,255,20,0.3)]">Viral Clips</span>
      </h1>
      
      <p className="text-[#90A89C] text-[14px] sm:text-[18px] max-w-2xl mx-auto font-medium leading-relaxed">
        AI-powered extraction for TikTok, Reels, and Shorts. Just paste a link and let our engine do the work.
      </p>
    </div>
  );
}
