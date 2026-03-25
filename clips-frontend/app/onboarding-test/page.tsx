import React from 'react';
import { OnboardingProgress } from '@/components/profile-setup/OnboardingProgress';

export default function OnboardingTestPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#050505] p-6 space-y-12">
      <div className="w-full max-w-2xl text-center space-y-4 mb-4">
        <h1 className="text-3xl font-bold text-white">Onboarding Progress Component Demo</h1>
        <p className="text-gray-400">Verifying the component at different steps.</p>
      </div>

      {/* Step 1 Demo */}
      <div className="w-full">
        <h2 className="text-xl text-[#17f9bf] mb-2 text-center">Step 1 of 3</h2>
        <OnboardingProgress currentStep={1} totalSteps={3} />
      </div>

      {/* Step 2 Demo */}
      <div className="w-full">
        <h2 className="text-xl text-[#17f9bf] mb-2 text-center">Step 2 of 3</h2>
        <OnboardingProgress currentStep={2} totalSteps={3} />
      </div>

      {/* Step 3 Demo */}
      <div className="w-full">
        <h2 className="text-xl text-[#17f9bf] mb-2 text-center">Step 3 of 3</h2>
        <OnboardingProgress currentStep={3} totalSteps={3} />
      </div>
    </main>
  );
}
