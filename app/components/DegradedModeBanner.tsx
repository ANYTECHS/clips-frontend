"use client";

/**
 * DegradedModeBanner
 *
 * Shown at the top of the dashboard main area whenever one or more external
 * services has a circuit breaker in OPEN or HALF_OPEN state.
 *
 * Design decisions:
 *  - Amber/warning palette — not red (not down, just degraded).
 *  - Collapsible: users can dismiss it for the session without losing context.
 *  - Lists affected services with a plain-English description of the fallback
 *    behaviour so users understand what still works.
 *  - "Refresh status" button fires an immediate re-poll without a full reload.
 *  - Renders nothing when all services are healthy or while the first poll is
 *    still in flight, so there's zero layout shift on a healthy system.
 */

import React, { useState, memo } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, X } from "lucide-react";
import type { CircuitBreakerSnapshot } from "@/app/lib/circuitBreaker";

// ─── Service metadata ─────────────────────────────────────────────────────────

interface ServiceMeta {
  label: string;
  fallbackDescription: string;
}

const SERVICE_META: Record<string, ServiceMeta> = {
  aiBackend: {
    label: "AI Processing",
    fallbackDescription:
      "New video jobs are queued and will be dispatched automatically once the service recovers.",
  },
  virusScan: {
    label: "Security Scanning",
    fallbackDescription:
      "File uploads may be paused or proceeding in limited mode. " +
      "Check with your administrator if uploads are failing.",
  },
  cloudStorage: {
    label: "Cloud Storage",
    fallbackDescription:
      "File uploads and downloads may be temporarily unavailable.",
  },
};

function getServiceMeta(name: string): ServiceMeta {
  return (
    SERVICE_META[name] ?? {
      label: name,
      fallbackDescription: "This service is temporarily degraded.",
    }
  );
}

// ─── State label helpers ──────────────────────────────────────────────────────

function stateLabel(state: CircuitBreakerSnapshot["state"]): string {
  switch (state) {
    case "OPEN":
      return "Unavailable";
    case "HALF_OPEN":
      return "Recovering";
    default:
      return "Healthy";
  }
}

function stateBadgeClass(state: CircuitBreakerSnapshot["state"]): string {
  switch (state) {
    case "OPEN":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "HALF_OPEN":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    default:
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DegradedModeBannerProps {
  /** Snapshots from useServiceHealth — only degraded ones are shown. */
  services: CircuitBreakerSnapshot[];
  /** Called when the user clicks "Refresh status". */
  onRefresh?: () => void;
  /** Last successful poll timestamp (ms), used to show recency. */
  lastCheckedAt?: number | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DegradedModeBanner = memo(function DegradedModeBanner({
  services,
  onRefresh,
  lastCheckedAt,
}: DegradedModeBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const degradedServices = services.filter((s) => s.state !== "CLOSED");

  // Render nothing when healthy or dismissed.
  if (degradedServices.length === 0 || dismissed) return null;

  const allDown = degradedServices.every((s) => s.state === "OPEN");
  const checkedAgo =
    lastCheckedAt !== null && lastCheckedAt !== undefined
      ? Math.round((Date.now() - lastCheckedAt) / 1000)
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Service degradation notice"
      className="mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm text-amber-200 text-sm"
    >
      {/* ── Header row ── */}
      <div className="flex items-center gap-3 px-4 py-3">
        <AlertTriangle
          className="w-4 h-4 text-amber-400 shrink-0"
          aria-hidden="true"
        />

        <p className="flex-1 font-medium leading-snug">
          {allDown
            ? "Some services are currently unavailable."
            : "Some services are operating in degraded mode."}{" "}
          <span className="font-normal text-amber-300/80">
            Fallback behaviours are active — core functionality continues.
          </span>
        </p>

        <div className="flex items-center gap-2 shrink-0">
          {/* Refresh button */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh service status"
              className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}

          {/* Expand / collapse detail */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Hide service details" : "Show service details"}
            className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>

          {/* Dismiss */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss this notice"
            className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="border-t border-amber-500/20 px-4 py-3 space-y-3">
          <ul className="space-y-2" aria-label="Affected services">
            {degradedServices.map((svc) => {
              const meta = getServiceMeta(svc.name);
              return (
                <li key={svc.name} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-amber-100">
                      {meta.label}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${stateBadgeClass(svc.state)}`}
                    >
                      {stateLabel(svc.state)}
                    </span>
                  </div>
                  <p className="text-amber-300/70 text-xs leading-relaxed">
                    {meta.fallbackDescription}
                  </p>
                </li>
              );
            })}
          </ul>

          {checkedAgo !== null && (
            <p className="text-[11px] text-amber-400/60">
              Status last checked {checkedAgo}s ago.{" "}
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="underline hover:text-amber-300 transition-colors"
                >
                  Check now
                </button>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

export default DegradedModeBanner;
