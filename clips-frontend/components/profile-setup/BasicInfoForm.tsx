"use client";

import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Dropdown } from '../ui/Dropdown';
import { Button } from '../ui/Button';

const CREATOR_TYPES = [
  { value: 'video', label: 'Video Creator' },
  { value: 'streamer', label: 'Streamer' },
  { value: 'podcaster', label: 'Podcaster' },
  { value: 'educator', label: 'Educator / Course Creator' },
  { value: 'other', label: 'Other' },
];

export const BasicInfoForm = () => {
  const [fullName, setFullName] = useState('');
  const [creatorType, setCreatorType] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting:", { fullName, creatorType });
    // In actual implementation, we'd proceed to Step 2
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 rounded-2xl bg-[#121212]/80 border border-gray-800 shadow-2xl backdrop-blur-xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Basic Information</h2>
        <p className="text-gray-400 text-sm">Let's start with the basics to set up your profile.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Full Name"
          placeholder="e.g. Jane Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <Dropdown
          label="Creator Type"
          placeholder="Select your niche"
          options={CREATOR_TYPES}
          value={creatorType}
          onChange={setCreatorType}
        />

        <div className="pt-4">
          <Button type="submit" fullWidth className="group">
            Continue to step 2
            <svg 
              className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Button>
        </div>
      </form>
      
      {/* Progress Indicators */}
      <div className="flex justify-center gap-2 mt-8">
        <div className="w-6 h-1.5 rounded-full bg-[#17f9bf] shadow-[0_0_10px_rgba(23,249,191,0.5)]"></div>
        <div className="w-6 h-1.5 rounded-full bg-gray-800"></div>
        <div className="w-6 h-1.5 rounded-full bg-gray-800"></div>
      </div>
    </div>
  );
};
