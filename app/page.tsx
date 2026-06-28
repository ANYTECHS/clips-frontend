"use client";

import React from "react";
import LandingLayout from "@/components/layout/LandingLayout";
import LandingHero from "@/components/layout/LandingHero";

export default function Home() {
  return (
    <LandingLayout
      hero={<LandingHero />}
      showAuthLoadingSkeleton={true}
      authFormMode="login"
    />
  );
}
