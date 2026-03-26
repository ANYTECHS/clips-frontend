"use client";

import React from 'react';

export interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({ 
  currentStep, 
  totalSteps,
  className = '' 
}) => {
  // Ensure the percentage is constrained between 0 and 100
  const percentage = Math.min(100, Math.max(0, Math.round((currentStep / totalSteps) * 100)));

  return (
    <div className={`w-full max-w-md mx-auto mb-8 p-6 rounded-2xl bg-[#121212]/80 border border-gray-800 shadow-xl backdrop-blur-xl ${className}`}>
      <div className="flex justify-between items-end mb-4">
        <div className="flex flex-col gap-1">
          <span className="text-gray-400 text-xs font-semibold tracking-wider uppercase">
            Current Progress
          </span>
          <span className="text-white text-sm font-medium">
            Step {currentStep} of {totalSteps}
          </span>
        </div>
        <span className="text-[#17f9bf] text-3xl font-black drop-shadow-[0_0_10px_rgba(23,249,191,0.2)]">
          {percentage}%
        </span>
      </div>

      <div className="bg-[#1a1a1a] border border-gray-800 h-3 rounded-full w-full overflow-hidden relative">
        <div 
          className="absolute top-0 left-0 h-full bg-[#17f9bf] rounded-full shadow-[0_0_15px_rgba(23,249,191,0.5)] transition-all duration-1000 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
