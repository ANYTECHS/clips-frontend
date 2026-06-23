"use client";

import React from "react";
import LandingLayout from "@/components/LandingLayout";
import LandingHero from "@/components/LandingHero";

export default function LoginPage() {
  return (
    <LandingLayout
      hero={
        <LandingHero
          badgeText="AI CLIPPING V2.0 IS LIVE"
          description="Preview, pick, post & mint — our AI-powered engine finds the high-retention moments for your viral growth across TikTok, Reels, and Shorts."
          showUrlForm={true}
          showSocialProof={false}
        />
      }
      showAuthLoadingSkeleton={false}
      authFormMode="login"
    />
  );
}
