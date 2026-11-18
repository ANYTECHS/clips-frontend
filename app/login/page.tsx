import React from "react";
import AuthForm from "@/components/AuthForm";
import LandingLayout from "@/components/shared/LandingLayout";

export default function LoginPage() {
  return (
    <LandingLayout>
      <div className="w-full flex flex-col lg:flex-row justify-between items-center lg:items-start gap-10 lg:gap-8 animate-in fade-in duration-700 zoom-in-95 my-4 sm:my-0 sm:mt-[-40px]">
        <div className="flex-1 space-y-4 max-w-[580px] text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#B6FF4A]/15 border border-[#B6FF4A]/30 text-[#B6FF4A] text-[11px] font-bold tracking-[0.1em] uppercase">
            <span className="w-2 h-2 rounded-full bg-[#39FF14]" style={{ boxShadow: "0 0 10px #39FF14" }} />
            AI CLIPPING V1.0 IS LIVE
          </div>
          
          <h1 className="text-[36px] sm:text-[48px] lg:text-[64px] font-extrabold leading-[1.08] tracking-tight text-[#F4F7EF]">
            Turn 1 long<br className="hidden sm:inline" /> video into <span className="text-[#B6FF4A]">100+</span><br className="hidden sm:inline" />
            <span className="text-[#B6FF4A]">viral clips</span>
          </h1>
          
          <p className="text-[#90A89C] text-base sm:text-lg max-w-[420px] mx-auto lg:mx-0 leading-[1.6]">
            Preview, pick, post & mint — our AI-powered engine finds the high-retention moments for your viral growth across TikTok, Reels, and Shorts.
          </p>
        </div>

        <div className="w-full max-w-[440px] flex justify-center lg:justify-end">
          <AuthForm mode="login" />
        </div>
      </div>
    </LandingLayout>
  );
}
