"use client";

import React from "react";
import { useI18n } from "@/app/lib/i18n/I18nProvider";
import { useFeeSponsorship } from "@/app/hooks/useFeeSponsorship";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";

interface FeeSponsorshipStatusProps {
  /** Number of operations the user wants to execute */
  operationCount?: number;
  /** Compact mode for embedding in forms */
  compact?: boolean;
}

export default function FeeSponsorshipStatus({
  operationCount = 1,
  compact = false,
}: FeeSponsorshipStatusProps) {
  const { t } = useI18n();
  const {
    status,
    sponsorBalance,
    estimatedFee,
    error,
    isSponsored,
    isTestnet,
    refresh,
  } = useFeeSponsorship(operationCount);

  if (!isTestnet) {
    return null;
  }

  // Loading state
  if (status === "checking") {
    return (
      <div
        className={`flex items-center gap-2 ${
          compact ? "py-1" : "px-4 py-3 rounded-xl bg-surface-hover border border-border"
        }`}
      >
        <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" aria-hidden="true" />
        <span className="text-[11px] text-muted">
          {t("common.loading")}
        </span>
      </div>
    );
  }

  // Sponsorship available
  if (isSponsored) {
    return (
      <div
        className={`flex items-center gap-2 ${
          compact
            ? "py-1"
            : "px-4 py-3 rounded-xl bg-brand/5 border border-brand/20"
        }`}
      >
        <Sparkles className="w-3.5 h-3.5 text-brand shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-brand">
            {t("fee_sponsorship.fee_sponsored")}
          </p>
          {!compact && estimatedFee && (
            <p className="text-[10px] text-muted mt-0.5">
              {t("fee_sponsorship.fee_paid_by_platform")}
              {sponsorBalance
                ? ` \u2022 ${t("fee_sponsorship.sponsor_balance")}: ${parseFloat(sponsorBalance).toFixed(2)} XLM`
                : ""}
            </p>
          )}
        </div>
        {!compact && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-bold">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Active
          </span>
        )}
      </div>
    );
  }

  // Insufficient balance
  if (status === "insufficient_balance") {
    return (
      <div
        className={`flex items-start gap-2 ${
          compact
            ? "py-1"
            : "px-4 py-3 rounded-xl bg-warning/5 border border-warning/20"
        }`}
      >
        <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-warning">
            {t("fee_sponsorship.sponsorship_disabled")}
          </p>
          {!compact && error && (
            <p className="text-[10px] text-muted mt-0.5">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // Sponsorship unavailable
  if (status === "unavailable") {
    return (
      <div
        className={`flex items-center gap-2 ${
          compact
            ? "py-1"
            : "px-4 py-3 rounded-xl bg-surface-hover border border-border"
        }`}
      >
        <Info className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
        <p className="text-[11px] text-muted">
          {t("fee_sponsorship.sponsorship_not_available")}
        </p>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-error/5 border border-error/20">
        <AlertCircle className="w-3.5 h-3.5 text-error shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-error">
            {t("common.error")}
          </p>
          {error && (
            <p className="text-[10px] text-muted mt-0.5">{error}</p>
          )}
        </div>
        <button
          onClick={refresh}
          className="text-[10px] text-error hover:text-white font-bold underline shrink-0 cursor-pointer"
        >
          {t("common.retry")}
        </button>
      </div>
    );
  }

  return null;
}
