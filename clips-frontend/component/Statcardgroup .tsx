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
        label="Moments Found"
        value="247"
        trend={5}
        trendLabel="this run"
        icon={<ClipsIcon />}
        iconColor="#00C27C"
        className="bento-stat-card"
      />
      <StatCard
        index={1}
        label="Input Quality"
        value="92%"
        trend={2.1}
        trendLabel="vs last run"
        icon={
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        }
        iconColor="#3B82F6"
        className="bento-stat-card"
      />
      <StatCard
        index={2}
        label="AI Throughput"
        value="12s"
        trend={-10.2}
        trendLabel="faster"
        icon={
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d="m9.17 16 3.67-6.78A1 1 0 0 1 14 9h2a1 1 0 0 1 .77.36l2.68 3.7a1 1 0 0 1-.27 1.5l-4.55 3.17A1 1 0 0 1 13 18H9a1 1 0 0 1-.17-2Z" />
              <path d="M6 6h2a1 1 0 0 1 1 .83l.5 5a1 1 0 0 1-.83 1H7a1 1 0 0 1-.83-.98L6 7A1 1 0 0 1 6 6Z" />
              <path d="M20 6h-2a1 1 0 0 0-1 .83l-.5 5A1 1 0 0 0 17 13h.83a1 1 0 0 1 .83.98l.5 4.02A1 1 0 0 0 20 19v-1a1 1 0 0 0-.45-.87l-2.69-1.87a1 1 0 0 1-.28-1.5l2.31-3.19A1 1 0 0 0 20 9V6Z" />
            </svg>
            <span className="text-xs font-bold absolute -top-1 -right-1 bg-black/50 px-1 rounded">
              Turbo
            </span>
          </>
        }
        iconColor="#FCD34D"
        className="bento-stat-card"
      />
    </>
  );
}
