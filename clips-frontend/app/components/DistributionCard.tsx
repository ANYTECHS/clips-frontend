"use client";

import PlatformDistribution from "./PlatformDistribution";

/**
 * Distribution Card Component
 * Displays platform distribution breakdown
 * Spans 1/3 width in the Bento grid layout
 */
export default function DistributionCard() {
  return (
    <div className="bento-distribution bento-card bento-card-tall">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">Platform Distribution</h3>
        <p className="text-sm text-zinc-400 mt-1">Content breakdown</p>
      </div>

      <PlatformDistribution />
    </div>
  );
}
