import React from "react";

type Status = "completed" | "pending" | "failed";

const config: Record<Status, { label: string; classes: string; dot: string }> = {
  completed: {
    label: "Completed",
    classes: "text-brand bg-brand/10 border border-brand/20",
    dot: "bg-brand shadow-[0_0_6px_rgba(0,229,143,0.8)]",
  },
  pending: {
    label: "Pending",
    classes: "text-yellow-400 bg-yellow-500/10 border border-yellow-500/20",
    dot: "bg-yellow-400",
  },
  failed: {
    label: "Failed",
    classes: "text-rose-400 bg-rose-500/10 border border-rose-500/20",
    dot: "bg-rose-400",
  },
};

interface StatusBadgeProps {
  status: Status;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const { label, classes, dot } = config[status];
  const textSize = size === "sm" ? "text-[10px]" : "text-[11px]";
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider ${textSize} ${padding} ${classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {label}
    </span>
  );
}
