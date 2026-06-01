import React from "react";

interface PlanUsageProps {
  usage: number;
}

export default function PlanUsage({ usage }: PlanUsageProps) {
  return (
    <div className="mt-auto px-2 py-4">
      <div className="flex items-center justify-between text-xs font-medium text-white mb-2">
        <span>Plan Usage</span>
        <span>{usage}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-[#00FF9D] transition-all duration-500"
          style={{ width: `${usage}%` }}
        />
      </div>
    </div>
  );
}
