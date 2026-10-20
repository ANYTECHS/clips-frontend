"use client";

import React, { useState } from "react";
import { formatXLM, formatAmount, XLM_CONSTANTS } from "@/app/lib/formatAmount";
import { Info, Copy, Check } from "lucide-react";

export interface XlmBalanceDisplayProps {
  balance: number | string;
  locale?: string;
  decimals?: number;
  showFullPrecisionOnHover?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function XlmBalanceDisplay({
  balance,
  locale,
  decimals = 2,
  showFullPrecisionOnHover = true,
  className = "",
  size = "md",
}: XlmBalanceDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showFullPrecision, setShowFullPrecision] = useState(false);

  const formattedDisplay = formatXLM(balance, {
    decimals: showFullPrecision ? XLM_CONSTANTS.FULL_PRECISION_DECIMALS : decimals,
    locale,
    includeCurrency: true,
  });

  const fullPrecisionString = formatXLM(balance, {
    decimals: XLM_CONSTANTS.FULL_PRECISION_DECIMALS,
    locale,
    includeCurrency: true,
  });

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rawVal = typeof balance === "number" ? balance.toString() : balance;
    navigator.clipboard.writeText(rawVal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sizeClasses = {
    sm: "text-xs font-semibold",
    md: "text-sm font-bold",
    lg: "text-xl font-extrabold",
  }[size];

  return (
    <div
      className={`inline-flex items-center gap-1.5 group cursor-pointer ${className}`}
      onClick={() => setShowFullPrecision((prev) => !prev)}
      title="Click to toggle full 7-decimal precision"
    >
      <span className={`font-mono text-white ${sizeClasses}`}>
        {formattedDisplay}
      </span>

      {showFullPrecisionOnHover && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy exact balance"
          className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-white transition-opacity"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-brand" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
}
