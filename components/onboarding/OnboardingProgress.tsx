import React from "react";
import Image from "next/image";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
}

export default function OnboardingProgress({
  currentStep,
  totalSteps,
  stepLabel,
}: OnboardingProgressProps) {
  const progressPercentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="bg-surface border border-border rounded-[20px] p-[24px] mt-8 w-full shadow-lg">
      <div className="flex justify-between items-end mb-4">
        <div>
          <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5">
            CURRENT PROGRESS
          </div>
          <div className="font-bold text-white text-[15px]">{stepLabel}</div>
        </div>
        <div className="text-[28px] font-extrabold text-brand leading-none">
          {progressPercentage}%
        </div>
      </div>
      <div className="w-full h-[10px] bg-input rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full shadow-[0_0_10px_rgba(0,229,143,0.5)]"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
}

export function OnboardingSocialProof() {
  return (
    <div className="flex items-center gap-4 text-[13px] text-muted-foreground pt-4">
      <div className="flex -space-x-2.5">
        <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-800 flex items-center justify-center overflow-hidden">
          <Image
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Nico&backgroundColor=c0aede"
            alt=""
            width={36}
            height={36}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-700 flex items-center justify-center overflow-hidden">
          <Image
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jane&backgroundColor=b6e3f4"
            alt=""
            width={36}
            height={36}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="w-9 h-9 rounded-full border-2 border-[#080C0B] bg-zinc-600 flex items-center justify-center overflow-hidden">
          <Image
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jack&backgroundColor=c0aede"
            alt=""
            width={36}
            height={36}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
      <div>
        Joined by <span className="font-bold text-white">2,500+</span> top creators this month.
      </div>
    </div>
  );
}
