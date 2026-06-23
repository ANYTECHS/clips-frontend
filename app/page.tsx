"use client";

import React from "react";
import LandingLayout from "@/components/LandingLayout";
import LandingHero from "@/components/LandingHero";

export default function Home() {
  return (
    <LandingLayout
      hero={<LandingHero />}
      showAuthLoadingSkeleton={true}
      authFormMode="login"
    />
  );
}
