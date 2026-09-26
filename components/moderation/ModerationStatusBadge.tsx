"use client";

/**
 * Moderation status indicator (Issue #1063).
 *
 * Wording is written for the creator, not the system: "In review" rather than
 * "flagged", because a creator reading "flagged" on their own clip assumes
 * they have done something wrong when the automated check was merely unsure.
 */

import { AlertTriangle, CheckCircle2, Clock, Eye, XCircle } from "lucide-react";
import type { ModerationStatus } from "@/app/lib/moderation/types";

const PRESENTATION: Record<
  ModerationStatus,
  { label: string; hint: string; icon: typeof Clock; className: string }
> = {
  pending: {
    label: "Checking",
    hint: "Automated review in progress. This usually takes a few seconds.",
    icon: Clock,
    className: "bg-white/5 text-white/70 border-white/10",
  },
  approved: {
    label: "Approved",
    hint: "Cleared for publishing.",
    icon: CheckCircle2,
    className: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  flagged: {
    label: "In review",
    hint: "Our automated check wasn't sure, so a person is taking a look.",
    icon: Eye,
    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  rejected: {
    label: "Not approved",
    hint: "This can't be published as-is. You can appeal the decision.",
    icon: XCircle,
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

export interface ModerationStatusBadgeProps {
  status: ModerationStatus;
  /** Show the explanatory sentence under the badge. */
  showHint?: boolean;
  className?: string;
}

export default function ModerationStatusBadge({
  status,
  showHint = false,
  className = "",
}: ModerationStatusBadgeProps) {
  const { label, hint, icon: Icon, className: tone } = PRESENTATION[status];

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}
        // The label alone reads as a state; the hint says what happens next,
        // which is what a creator actually needs from a status chip.
        title={hint}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </span>
      {showHint && <span className="text-xs text-white/50">{hint}</span>}
    </div>
  );
}

/** Compact inline warning for content that cannot publish. */
export function ModerationBlockNotice({ reason }: { reason: string | null }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold text-red-200">This clip can&apos;t be published</p>
        {reason && <p className="mt-0.5 text-red-300/80">{reason}</p>}
      </div>
    </div>
  );
}
