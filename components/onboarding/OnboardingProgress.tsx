import React from "react";
import Image from "next/image";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
  steps?: { title: string; isCompleted: boolean }[];
}

export default function OnboardingProgress({
  currentStep,
  totalSteps,
  stepLabel,
  steps = [
    { title: "Profile", isCompleted: currentStep > 1 },
    { title: "Socials", isCompleted: currentStep > 2 },
    { title: "Wallet", isCompleted: currentStep > 3 },
  ],
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

      <div className="w-full h-[10px] bg-input rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-brand rounded-full shadow-[0_0_10px_rgba(0,229,143,0.5)] transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Step Breakdown Indicators */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
        {steps.map((st, idx) => {
          const stepNum = idx + 1;
          const isActive = currentStep === stepNum;
          return (
            <div key={st.title} className="flex items-center gap-1.5 text-xs">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  st.isCompleted
                    ? "bg-brand text-black"
                    : isActive
                      ? "bg-white/20 text-white border border-brand/50"
                      : "bg-white/5 text-white/40"
                }`}
              >
                {st.isCompleted ? "✓" : stepNum}
              </span>
              <span
                className={`text-[11px] truncate ${
                  isActive ? "text-white font-semibold" : "text-white/40"
                }`}
              >
                {st.title}
              </span>
            </div>
          );
        })}
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
