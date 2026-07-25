"use client";

import React, { useState, useEffect, useCallback, useId } from "react";
import Link from "next/link";
import {
  Clock,
  Zap,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  Infinity as InfinityIcon,
} from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import type { TransformStyle } from "@/app/api/transform/styles/route";

/* ─── Re-export so consumers can import from this module ────────────────────── */
export type { TransformStyle };

/* ─── Types ──────────────────────────────────────────────────────────────────── */

export interface QuotaInfo {
  /**
   * Transforms remaining this month.
   * `null` means unlimited (enterprise).
   */
  remaining: number | null;
  /** Total monthly allowance. `null` means unlimited. */
  limit: number | null;
  /** ISO-8601 date of the next quota reset. `null` for unlimited plans. */
  resetAt: string | null;
  /** true when the plan has no cap at all */
  unlimited: boolean;
}

export interface StylePickerProps {
  /** Currently selected style ID (controlled). */
  selectedStyleId?: string | null;
  /**
   * Called when the user picks a style.
   * `isPreview` is true while the low-res preview is generating,
   * false once it resolves and the selection is confirmed.
   */
  onSelect?: (style: TransformStyle, isPreview: boolean) => void;
  /** Disable all cards (e.g. full processing is already running). */
  disabled?: boolean;
  /**
   * Provide the style list directly — skips the internal fetch.
   * Useful for Storybook and unit tests.
   */
  styles?: TransformStyle[];
  /**
   * Provide quota data directly — skips the internal fetch.
   * When omitted the component fetches GET /api/transform.
   */
  quota?: QuotaInfo;
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function formatDuration(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `~${m}m` : `~${m}m ${s}s`;
}

function formatResetDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/* ─── Quota bar ──────────────────────────────────────────────────────────────── */

interface QuotaBarProps {
  quota: QuotaInfo;
}

function QuotaBar({ quota }: QuotaBarProps) {
  if (quota.unlimited) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand/10 border border-brand/20">
        <InfinityIcon className="w-4 h-4 text-brand shrink-0" />
        <span className="text-[13px] font-bold text-brand">
          Unlimited transforms
        </span>
        <span className="text-[12px] text-muted-foreground ml-auto">
          Enterprise plan
        </span>
      </div>
    );
  }

  const { remaining, limit, resetAt } = quota;
  const isExhausted = remaining !== null && remaining <= 0;
  const pct =
    remaining !== null && limit !== null && limit > 0
      ? Math.round(((limit - remaining) / limit) * 100)
      : 0;

  // Colour the bar: green → yellow at 60% used → red at 90% used
  const barColor =
    pct >= 90
      ? "#EF4444"
      : pct >= 60
      ? "#FACC15"
      : "#00E58F";

  return (
    <div
      className={[
        "rounded-xl border px-4 py-3 space-y-2",
        isExhausted
          ? "bg-red-500/10 border-red-500/20"
          : "bg-surface/60 border-white/[0.06]",
      ].join(" ")}
      role="status"
      aria-label={`Transform quota: ${remaining ?? 0} of ${limit} remaining`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: isExhausted ? "#EF4444" : "#00E58F" }}
          />
          <span
            className={[
              "text-[13px] font-bold",
              isExhausted ? "text-red-400" : "text-white",
            ].join(" ")}
          >
            {isExhausted
              ? "Quota exhausted"
              : `${remaining} transform${remaining === 1 ? "" : "s"} remaining`}
          </span>
        </div>

        {resetAt && (
          <span className="text-[11px] text-muted-foreground shrink-0">
            Resets {formatResetDate(resetAt)}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {limit !== null && (
        <div
          className="w-full h-1.5 rounded-full overflow-hidden bg-white/[0.06]"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${pct}%`,
              backgroundColor: barColor,
              boxShadow: `0 0 8px ${barColor}66`,
            }}
          />
        </div>
      )}

      {/* Upgrade CTA when exhausted */}
      {isExhausted && (
        <Link
          href="/settings?tab=billing"
          className="mt-1 flex items-center gap-1.5 w-fit text-[12px] font-bold text-brand hover:text-brand-hover transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          Upgrade plan to continue
        </Link>
      )}
    </div>
  );
}

/* ─── Quota skeleton ─────────────────────────────────────────────────────────── */

function QuotaBarSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface/60 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  );
}

/* ─── Placeholder thumbnail ──────────────────────────────────────────────────── */

function ThumbnailPlaceholder({
  accentColor,
  label,
}: {
  accentColor: string;
  label: string;
}) {
  return (
    <div
      className="w-full h-full flex items-center justify-center rounded-[10px]"
      style={{ background: `${accentColor}18` }}
      aria-label={label}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-widest opacity-40"
        style={{ color: accentColor }}
      >
        {label}
      </span>
    </div>
  );
}

/* ─── Before / After thumbnail strip ────────────────────────────────────────── */

interface ThumbnailStripProps {
  style: TransformStyle;
  revealAfter: boolean;
}

function ThumbnailStrip({ style, revealAfter }: ThumbnailStripProps) {
  const [beforeLoaded, setBeforeLoaded] = useState(false);
  const [afterLoaded, setAfterLoaded] = useState(false);

  return (
    <div className="relative w-full h-[88px] rounded-[10px] overflow-hidden bg-surface-hover flex">
      {/* Before */}
      <div className="relative flex-1 overflow-hidden">
        {!beforeLoaded && (
          <ThumbnailPlaceholder accentColor={style.accentColor} label="before" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={style.thumbnailBefore}
          alt={`${style.name} before`}
          onLoad={() => setBeforeLoaded(true)}
          onError={() => setBeforeLoaded(false)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            beforeLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
        <span className="absolute bottom-1 left-1.5 text-[9px] font-black uppercase tracking-wider text-white/50 bg-black/40 px-1.5 py-0.5 rounded-md">
          Before
        </span>
      </div>

      {/* Divider */}
      <div className="w-px bg-white/10 shrink-0" />

      {/* After */}
      <div className="relative flex-1 overflow-hidden">
        {!afterLoaded && (
          <ThumbnailPlaceholder accentColor={style.accentColor} label="after" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={style.thumbnailAfter}
          alt={`${style.name} after`}
          onLoad={() => setAfterLoaded(true)}
          onError={() => setAfterLoaded(false)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            afterLoaded && revealAfter ? "opacity-100" : "opacity-0"
          }`}
        />
        {revealAfter && (
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${style.accentColor}22, transparent 70%)`,
            }}
          />
        )}
        <span className="absolute bottom-1 right-1.5 text-[9px] font-black uppercase tracking-wider text-white/50 bg-black/40 px-1.5 py-0.5 rounded-md">
          After
        </span>
      </div>
    </div>
  );
}

/* ─── Single style card ──────────────────────────────────────────────────────── */

interface StyleCardProps {
  style: TransformStyle;
  isSelected: boolean;
  isPreviewing: boolean;
  /** Card-level disabled: either global disabled prop or quota exhausted */
  disabled: boolean;
  quotaExhausted: boolean;
  onSelect: (style: TransformStyle) => void;
  headingId: string;
}

function StyleCard({
  style,
  isSelected,
  isPreviewing,
  disabled,
  quotaExhausted,
  onSelect,
  headingId,
}: StyleCardProps) {
  const isThisPreviewing = isPreviewing && isSelected;
  const showAfter = isSelected && !isThisPreviewing;

  return (
    <article
      aria-labelledby={headingId}
      aria-selected={isSelected}
      className={[
        "relative flex flex-col gap-4 rounded-[20px] p-5 border transition-all duration-300",
        "bg-surface/40 backdrop-blur-md",
        isSelected
          ? "border-[2px]"
          : "border border-white/[0.05] hover:border-white/10",
        disabled && !isSelected ? "opacity-50" : "",
      ].join(" ")}
      style={
        isSelected
          ? {
              borderColor: style.accentColor,
              boxShadow: `0 0 24px ${style.accentColor}28, 0 0 0 1px ${style.accentColor}18 inset`,
            }
          : undefined
      }
    >
      {/* Selected badge */}
      {isSelected && (
        <div
          className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
          style={{
            color: style.accentColor,
            background: `${style.accentColor}18`,
            border: `1px solid ${style.accentColor}35`,
          }}
        >
          <CheckCircle2 className="w-3 h-3" />
          {isThisPreviewing ? "Previewing…" : "Selected"}
        </div>
      )}

      <ThumbnailStrip style={style} revealAfter={showAfter} />

      <div className="space-y-0.5">
        <h3
          id={headingId}
          className="text-[15px] font-bold text-white tracking-tight"
        >
          {style.name}
        </h3>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          {style.description}
        </p>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>{formatDuration(style.avgDurationSeconds)} processing</span>
      </div>

      <button
        type="button"
        onClick={() => onSelect(style)}
        disabled={disabled}
        aria-pressed={isSelected}
        aria-label={
          quotaExhausted && !isSelected
            ? `${style.name} style — quota exhausted, upgrade to use`
            : `Select ${style.name} style`
        }
        className={[
          "w-full py-3 rounded-xl font-bold text-[13px] transition-all duration-200",
          "flex items-center justify-center gap-2",
          "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
          isSelected
            ? "border border-white/10 text-white hover:bg-white/[0.05]"
            : "text-black hover:brightness-110 shadow-lg",
        ].join(" ")}
        style={
          isSelected
            ? undefined
            : {
                backgroundColor: style.accentColor,
                boxShadow: `0 0 20px ${style.accentColor}40`,
              }
        }
      >
        {isThisPreviewing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating preview…
          </>
        ) : isSelected ? (
          <>
            <Zap className="w-3.5 h-3.5" />
            Apply style
          </>
        ) : quotaExhausted ? (
          <>
            <ArrowUpRight className="w-3.5 h-3.5" />
            Upgrade to use
          </>
        ) : (
          "Preview style"
        )}
      </button>
    </article>
  );
}

/* ─── Loading skeleton grid ──────────────────────────────────────────────────── */

function StylePickerSkeleton() {
  return (
    <div className="space-y-4">
      <QuotaBarSkeleton />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-[20px] p-5 border border-white/[0.05] bg-surface/40"
            aria-hidden="true"
          >
            <Skeleton className="w-full h-[88px] rounded-[10px]" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="w-full h-11 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Error state ─────────────────────────────────────────────────────────────── */

function StylePickerError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-[14px] text-muted-foreground">
        Failed to load transformation styles.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white text-[13px] font-bold hover:bg-white/[0.05] transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Try again
      </button>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

/** Low-res preview simulation delay (ms). Replace with a real API call in production. */
const PREVIEW_DELAY_MS = 1200;

export default function StylePicker({
  selectedStyleId = null,
  onSelect,
  disabled = false,
  styles: stylesProp,
  quota: quotaProp,
}: StylePickerProps) {
  const [styles, setStyles] = useState<TransformStyle[]>(stylesProp ?? []);
  const [stylesLoading, setStylesLoading] = useState(!stylesProp);
  const [stylesError, setStylesError] = useState(false);

  const [quota, setQuota] = useState<QuotaInfo | null>(quotaProp ?? null);
  const [quotaLoading, setQuotaLoading] = useState(!quotaProp);

  const [selectedId, setSelectedId] = useState<string | null>(
    selectedStyleId ?? null
  );
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const uid = useId();

  // Sync controlled selectedStyleId prop
  useEffect(() => {
    if (selectedStyleId !== undefined) {
      setSelectedId(selectedStyleId ?? null);
    }
  }, [selectedStyleId]);

  // ── Fetch styles ────────────────────────────────────────────────────────────
  const fetchStyles = useCallback(async () => {
    setStylesLoading(true);
    setStylesError(false);
    try {
      const res = await fetch("/api/transform/styles");
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setStyles(data.styles ?? []);
    } catch {
      setStylesError(true);
    } finally {
      setStylesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!stylesProp) fetchStyles();
  }, [fetchStyles, stylesProp]);

  useEffect(() => {
    if (stylesProp) {
      setStyles(stylesProp);
      setStylesLoading(false);
    }
  }, [stylesProp]);

  // ── Fetch quota ─────────────────────────────────────────────────────────────
  const fetchQuota = useCallback(async () => {
    setQuotaLoading(true);
    try {
      const res = await fetch("/api/transform");
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setQuota({
        remaining: data.quotaRemaining,
        limit: data.quotaLimit,
        resetAt: data.resetAt,
        unlimited: data.unlimited ?? false,
      });
    } catch {
      // Non-fatal: quota bar simply won't render
    } finally {
      setQuotaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!quotaProp) fetchQuota();
  }, [fetchQuota, quotaProp]);

  useEffect(() => {
    if (quotaProp) {
      setQuota(quotaProp);
      setQuotaLoading(false);
    }
  }, [quotaProp]);

  // ── Derived state ───────────────────────────────────────────────────────────
  const quotaExhausted =
    quota !== null &&
    !quota.unlimited &&
    quota.remaining !== null &&
    quota.remaining <= 0;

  // ── Selection handler ───────────────────────────────────────────────────────
  const handleSelect = useCallback(
    (style: TransformStyle) => {
      // Block if: globally disabled, another preview in-flight, or quota gone
      if (disabled || previewingId || quotaExhausted) return;

      // Already selected → confirm apply (non-preview)
      if (selectedId === style.id) {
        onSelect?.(style, false);
        return;
      }

      setSelectedId(style.id);
      setPreviewingId(style.id);
      onSelect?.(style, true);

      setTimeout(() => {
        setPreviewingId(null);
        onSelect?.(style, false);
      }, PREVIEW_DELAY_MS);
    },
    [disabled, previewingId, quotaExhausted, selectedId, onSelect]
  );

  const loading = stylesLoading || quotaLoading;
  if (loading) return <StylePickerSkeleton />;
  if (stylesError) return <StylePickerError onRetry={fetchStyles} />;

  return (
    <section aria-label="AI transformation style picker" className="space-y-4">
      {/* Quota bar — always rendered once quota is known */}
      {quota && <QuotaBar quota={quota} />}

      {/* Upgrade CTA banner when exhausted (prominent, above the grid) */}
      {quotaExhausted && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-brand/[0.07] border border-brand/20">
          <div className="space-y-0.5">
            <p className="text-[13px] font-bold text-white">
              You&apos;ve used all your transforms this month
            </p>
            <p className="text-[12px] text-muted-foreground">
              Upgrade to Pro (50/month) or Enterprise (unlimited) to keep
              creating.
            </p>
          </div>
          <Link
            href="/settings?tab=billing"
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-black text-[13px] font-bold transition-all active:scale-[0.98]"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Upgrade Plan
          </Link>
        </div>
      )}

      {/* Style grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {styles.map((style) => {
          const isSelected = selectedId === style.id;
          // When quota is exhausted, only disable cards that aren't already
          // selected so the user can still see their chosen style.
          const cardDisabled =
            disabled ||
            (previewingId !== null && previewingId !== style.id) ||
            (quotaExhausted && !isSelected);

          return (
            <StyleCard
              key={style.id}
              style={style}
              isSelected={isSelected}
              isPreviewing={previewingId === style.id}
              disabled={cardDisabled}
              quotaExhausted={quotaExhausted}
              onSelect={handleSelect}
              headingId={`${uid}-${style.id}`}
            />
          );
        })}
      </div>
    </section>
  );
}
