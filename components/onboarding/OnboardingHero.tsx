import React from "react";
import Image from "next/image";

export default function OnboardingHero() {
  return (
    <div className="flex-1 space-y-8 max-w-[500px]">
      <div className="text-[#B6FF4A] text-[11px] font-black tracking-[0.1em] uppercase">
        ONBOARDING EXPERIENCE
      </div>

      <h1 className="text-[64px] font-extrabold leading-[1.05] tracking-tight text-[#F4F7EF]">
        Turn your long-form content into <span className="text-[#B6FF4A]">gold.</span>
      </h1>

      <p className="text-[#90A89C] text-[16px] max-w-[420px] leading-[1.6]">
        Our AI identifies the most viral moments from your videos and formats them for every platform instantly.
      </p>

      {/* Progress Card */}
      <div className="bg-[#06351C] border border-[#0e4d2a] rounded-[20px] p-[24px] mt-8 w-full shadow-lg">
        <div className="flex justify-between items-end mb-4">
          <div>
            <div className="text-[#90A89C] text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5">
              CURRENT PROGRESS
            </div>
            <div className="font-bold text-[#F4F7EF] text-[15px]">
              Step 1 of 2: Profile Setup
            </div>
          </div>
          <div className="text-[28px] font-extrabold text-[#B6FF4A] leading-none">
            50%
          </div>
        </div>
        <div className="w-full h-[10px] bg-[#042413] rounded-full overflow-hidden border border-[#0e4d2a]">
          <div
            className="h-full bg-[#39FF14] rounded-full shadow-[0_0_10px_rgba(57,255,20,0.5)]"
            style={{ width: "50%" }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 text-[13px] text-[#90A89C] pt-4">
        <div className="flex -space-x-2.5">
          <div className="w-9 h-9 rounded-full border-2 border-[#020D08] bg-[#042413] flex items-center justify-center overflow-hidden relative">
            <Image
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Nico&backgroundColor=c0aede"
              alt="user"
              fill
              sizes="36px"
              className="object-cover"
            />
          </div>
          <div className="w-9 h-9 rounded-full border-2 border-[#020D08] bg-[#042413] flex items-center justify-center overflow-hidden relative">
            <Image
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jane&backgroundColor=b6e3f4"
              alt="user"
              fill
              sizes="36px"
              className="object-cover"
            />
          </div>
          <div className="w-9 h-9 rounded-full border-2 border-[#020D08] bg-[#042413] flex items-center justify-center overflow-hidden relative">
            <Image
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jack&backgroundColor=c0aede"
              alt="user"
              fill
              sizes="36px"
              className="object-cover"
            />
          </div>
        </div>
        <div>
          Joined by <span className="font-bold text-[#F4F7EF]">2,500+</span> top creators this month.
        </div>
      </div>
    </div>
  );
}
