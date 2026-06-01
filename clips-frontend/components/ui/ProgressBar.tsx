import React from "react";

interface ProgressBarProps {
  value: number; // 0–100
  color: string; // hex or CSS color
  label: string; // accessible label
  animated?: boolean;
  height?: "sm" | "md" | "lg";
}

const heights = { sm: "h-1.5", md: "h-2.5", lg: "h-3.5" };

export default function ProgressBar({
  value,
  color,
  label,
  animated = true,
  height = "md",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${clamped}%`}
      className={`w-full bg-white/[0.06] rounded-full overflow-hidden ${heights[height]}`}
    >
      <div
        className={`h-full rounded-full ${animated ? "transition-all duration-700 ease-out" : ""}`}
        style={{
          width: `${clamped}%`,
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}55`,
        }}
      />
    </div>
  );
}
