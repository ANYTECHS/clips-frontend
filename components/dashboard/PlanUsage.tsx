"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Zap, ArrowUpRight } from "lucide-react";
import {
  useUserStore,
  selectUserPlan,
  selectPlanUsage,
  selectTransformQuotaRemaining,
} from "@/app/store/userStore";
import ProgressBar from "@/components/ui/ProgressBar";

/** Quota usage at or above this shows the bar in red. */
const USAGE_CRITICAL_PERCENT = 90;

/** Quota usage at or above this shows the bar in amber. */
const USAGE_WARNING_PERCENT = 70;

interface PlanUsageProps {
  compact?: boolean;
  className?: string;
}

export default function PlanUsage({ compact = false, className = "" }: PlanUsageProps) {
  const plan = useUserStore(selectUserPlan);
  const usagePercent = useUserStore(selectPlanUsage);
  const quotaRemaining = useUserStore(selectTransformQuotaRemaining);
  const fetchUser = useUserStore((s) => s.fetchUser);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const planLabel = plan.toUpperCase();
  const isFree = plan === "free";

  // Shared by the compact and full variants so the two bars cannot drift apart.
  const usageFillClassName =
    usagePercent >= USAGE_CRITICAL_PERCENT
      ? "bg-red-500"
      : usagePercent >= USAGE_WARNING_PERCENT
        ? "bg-yellow-400"
        : "bg-brand";

  if (compact) {
    return (
      <div className={`flex items-center gap-3 bg-surface border border-white/10 px-3.5 py-2 rounded-xl text-xs ${className}`}>
        <div className="flex items-center gap-1.5 font-bold text-white">
          <Zap className="w-3.5 h-3.5 text-brand" />
          <span>{planLabel}</span>
        </div>
        <ProgressBar
          value={usagePercent}
          className="w-20 bg-input rounded-full h-2 border border-white/5"
          fillClassName={usageFillClassName}
          label={`Monthly quota usage: ${usagePercent}%`}
        />
        <span className="text-[11px] text-muted font-medium">{usagePercent}%</span>
        {isFree && (
          <Link
            href="/billing"
            className="ml-auto text-[11px] font-bold text-brand hover:underline flex items-center gap-0.5"
          >
            Upgrade <ArrowUpRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-surface border border-white/10 rounded-2xl p-4 space-y-3.5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-brand" />
          </div>
          <div>
            <span className="text-xs font-bold text-white">{planLabel} Plan</span>
            <p className="text-[11px] text-muted">{quotaRemaining} transforms left</p>
          </div>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand/10 text-brand uppercase border border-brand/20">
          {plan}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[11px] font-medium text-muted">
          <span>Monthly Quota Usage</span>
          <span className="text-white font-bold">{usagePercent}%</span>
        </div>
        <ProgressBar
          value={usagePercent}
          className="w-full bg-input rounded-full h-2 border border-white/5"
          fillClassName={usageFillClassName}
          label={`Monthly quota usage: ${usagePercent}%`}
        />
      </div>

      <Link
        href="/billing"
        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-brand text-black font-bold text-xs hover:bg-brand-hover transition-colors shadow-[0_0_12px_rgba(0,229,143,0.2)]"
      >
        <span>Manage Plan & Upgrade</span>
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
