import React from 'react';
import { BasicInfoForm } from '@/components/profile-setup/BasicInfoForm';

export const metadata = {
  title: 'Profile Setup - Clips',
  description: 'Set up your Creator profile',
};

export default function ProfileSetupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#050505] p-4 relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#17f9bf]/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#17f9bf]/5 blur-[100px]"></div>
      </div>
      
      <div className="w-full relative z-10 py-12">
        <div className="text-center mb-10 w-full max-w-md mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 flex items-center justify-center gap-2">
            Welcome to <span className="text-[#17f9bf] inline-block drop-shadow-[0_0_15px_rgba(23,249,191,0.3)]">Clips</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg">
            Complete your profile in three simple steps to start analyzing your content.
          </p>
        </div>
        
        <BasicInfoForm />
      </div>
    </main>
  );
}
