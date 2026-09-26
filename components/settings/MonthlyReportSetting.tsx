"use client";

/**
 * MonthlyReportSetting — opt in to the monthly earnings report email
 * (Issue #820).
 *
 * Self-contained: it reads and writes its own preference rather than being
 * threaded through the settings page's state, because nothing else on that
 * page depends on it and a failed toggle should not disturb the rest.
 */

import { FileSpreadsheet, Loader2 } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

import { FAILURE_MESSAGES, safeErrorMessage } from "@/app/lib/errorMessages";

interface ScheduleState {
  enabled: boolean;
  deliveryEmail: string;
  lastSentAt: string | null;
}

export default function MonthlyReportSetting() {
  const [state, setState] = useState<ScheduleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/earnings/schedule-report");
        if (!res.ok) throw new Error("Could not load your preference");

        const body = (await res.json()) as { data: ScheduleState };
        if (!cancelled) setState(body.data);
      } catch (err) {
        if (!cancelled) {
          setError(safeErrorMessage(err, FAILURE_MESSAGES.loadPreference, "load preference"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(async () => {
    if (!state || saving) return;

    const next = !state.enabled;
    setSaving(true);
    setError(null);

    // Optimistic: the switch should move under the user's finger. Reverted
    // below if the write fails, which is the only case where the displayed
    // state could be wrong.
    setState({ ...state, enabled: next });

    try {
      const res = await fetch("/api/earnings/schedule-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });

      if (!res.ok) throw new Error("Could not save your preference");

      const body = (await res.json()) as { data: { enabled: boolean } };
      setState((prev) => (prev ? { ...prev, enabled: body.data.enabled } : prev));
    } catch (err) {
      setState((prev) => (prev ? { ...prev, enabled: !next } : prev));
      setError(safeErrorMessage(err, FAILURE_MESSAGES.savePreference, "save preference"));
    } finally {
      setSaving(false);
    }
  }, [state, saving]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-white">Earnings Reports</h2>
        <div className="bg-surface border border-white/5 rounded-2xl p-6 h-24 animate-pulse" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-white">Earnings Reports</h2>
        <div className="bg-surface border border-white/5 rounded-2xl p-6">
          <p role="alert" className="text-xs text-red-400">
            {error ?? FAILURE_MESSAGES.loadPreference}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-extrabold text-white">Earnings Reports</h2>

      <div className="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-white">Monthly Report Email</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              On the 1st of each month, we email last month&apos;s earnings summary to{" "}
              <span className="text-white/80">{state.deliveryEmail}</span> with a CSV export
              attached for your tax records.
            </p>
            {state.lastSentAt && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Last sent {new Date(state.lastSentAt).toLocaleDateString()}
              </p>
            )}
            {error && (
              <p role="alert" className="text-[11px] text-red-400 mt-1.5">
                {error}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={state.enabled}
          aria-label="Monthly Report Email"
          onClick={toggle}
          disabled={saving}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            state.enabled ? "bg-brand" : "bg-white/15"
          }`}
        >
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white transition-transform ${
              state.enabled ? "translate-x-6" : "translate-x-1"
            }`}
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin text-black" aria-hidden="true" />}
          </span>
        </button>
      </div>
    </div>
  );
}
