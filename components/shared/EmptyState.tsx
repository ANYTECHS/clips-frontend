"use client";

import React from "react";
import { Button } from "@/components/shared/Button";

interface EmptyStateProps {
  /** Inline SVG illustration key — kept dependency-free. */
  illustration?: "clips" | "projects" | "earnings" | "generic";
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
  ctaHref?: string;
}

const ILLUSTRATIONS: Record<string, React.ReactNode> = {
  clips: (
    <svg viewBox="0 0 120 80" className="w-28 h-20" aria-hidden="true">
      <rect x="8" y="12" width="104" height="56" rx="10" fill="#042413" stroke="#0e4d2a" />
      <rect x="18" y="22" width="50" height="36" rx="6" fill="#06351C" />
      <path d="M40 34l14 8-14 8z" fill="#B6FF4A" />
      <rect x="74" y="26" width="28" height="6" rx="3" fill="#0e4d2a" />
      <rect x="74" y="38" width="20" height="6" rx="3" fill="#0e4d2a" />
      <rect x="74" y="50" width="24" height="6" rx="3" fill="#0e4d2a" />
    </svg>
  ),
  projects: (
    <svg viewBox="0 0 120 80" className="w-28 h-20" aria-hidden="true">
      <rect x="14" y="18" width="36" height="44" rx="8" fill="#042413" stroke="#0e4d2a" />
      <rect x="56" y="10" width="36" height="52" rx="8" fill="#06351C" stroke="#0e4d2a" />
      <rect x="70" y="22" width="8" height="8" rx="2" fill="#B6FF4A" opacity="0.5" />
      <rect x="82" y="22" width="8" height="8" rx="2" fill="#B6FF4A" opacity="0.3" />
    </svg>
  ),
  earnings: (
    <svg viewBox="0 0 120 80" className="w-28 h-20" aria-hidden="true">
      <rect x="16" y="40" width="14" height="26" rx="4" fill="#0e4d2a" />
      <rect x="38" y="28" width="14" height="38" rx="4" fill="#0e4d2a" />
      <rect x="60" y="18" width="14" height="48" rx="4" fill="#B6FF4A" opacity="0.7" />
      <rect x="82" y="8" width="14" height="58" rx="4" fill="#B6FF4A" />
    </svg>
  ),
  generic: (
    <svg viewBox="0 0 120 80" className="w-28 h-20" aria-hidden="true">
      <circle cx="60" cy="40" r="30" fill="#042413" stroke="#0e4d2a" />
      <path d="M48 42l8 8 16-16" stroke="#B6FF4A" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/**
 * Issue #1381 — illustrated empty state with primary CTA.
 * Use for empty clips/projects/earnings lists.
 */
export default function EmptyState({
  illustration = "generic",
  title,
  description,
  ctaLabel,
  onCta,
  ctaHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="mb-5">{ILLUSTRATIONS[illustration]}</div>
      <h3 className="text-[18px] font-extrabold text-[#F4F7EF] mb-2">{title}</h3>
      {description && <p className="text-[13px] text-[#90A89C] max-w-[380px] mb-6">{description}</p>}
      {ctaLabel &&
        (ctaHref ? (
          <a href={ctaHref}>
            <Button>{ctaLabel}</Button>
          </a>
        ) : (
          <Button onClick={onCta}>{ctaLabel}</Button>
        ))}
    </div>
  );
}
