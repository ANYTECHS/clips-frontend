"use client";

import StatCard from "./Statcard ";
import Image from "next/image";

/**
 * components/StatCardGroup.tsx
 *
 * Drop this anywhere in your dashboard to render the three KPI cards.
 * Swap the `value` / `trend` props with real data from your API.
 */


function EarningsIcon() {
  return (
    <div className="relative w-4.5 h-4.5 shrink-0">
      <Image
        src="/images/Icon2.png"
        alt="Earnings"
        fill
        className="object-contain"
        aria-hidden="true"
      />
    </div>
  );
}

function ClipsIcon() {
  return (
    <div className="relative w-4.5 h-4.5 shrink-0">
      <Image
        src="/images/Icon1.png"
        alt="Clips"
        fill
        className="object-contain"
        aria-hidden="true"
      />
    </div>
  );
}

function PlatformsIcon() {
  return (
    <div className="relative w-4.5 h-4.5 shrink-0">
      <Image
        src="/images/Icon.png"
        alt="Platforms"
        fill
        className="object-contain"
        aria-hidden="true"
      />
    </div>
  );
}

// ─── Group ────────────────────────────────────────────────────────────────────

export default function StatCardGroup() {
  return (
    <>
       <StatCard
        index={0}
        label="Total Earnings"
        value="$12,450.80"
        trend={12.5}
        trendLabel=""
        icon={<EarningsIcon />}
        iconColor="#00C27C"
        className="bento-stat-card"
      />
      <StatCard
        index={1}
        label="Clips Posted"
        value="142"
        trend={8.2}
        trendLabel=""
        icon={<ClipsIcon />}
        iconColor="#00C27C"
        className="bento-stat-card"
      />
      <StatCard
        index={2}
        label="Active Platforms"
        value="4" 
        trend={0}
        trendLabel="Steady" 
        icon={<PlatformsIcon />}
        iconColor="#00C27C"
        className="bento-stat-card"
      />
    </>
  );
}