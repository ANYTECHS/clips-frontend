"use client";

/**
 * Tutorial completion tracking (Issue #1065).
 *
 * # Why progress is written twice
 *
 * Locally first, then to the server. The local write is what makes "skip"
 * feel instant and what keeps the tour from restarting if the request fails;
 * the server write is what stops a finished tour reappearing on a new device.
 * Writing only to the server would re-run a completed tour on every network
 * blip, which is worse than the tour never existing.
 *
 * The server is authoritative on load: a stale local record from before a
 * sign-out should not suppress a tour for a different account on the same
 * browser.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_PROGRESS } from "@/app/lib/tutorial/types";
import type { TourId, TutorialProgress } from "@/app/lib/tutorial/types";

const STORAGE_KEY = "clips:tutorial-progress";

function loadLocal(): TutorialProgress {
  if (typeof window === "undefined") return EMPTY_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<TutorialProgress>;
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      skipped: Array.isArray(parsed.skipped) ? parsed.skipped : [],
      dismissedTips: Array.isArray(parsed.dismissedTips) ? parsed.dismissedTips : [],
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

function saveLocal(progress: TutorialProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable — the server copy still carries this.
  }
}

export interface UseTutorialProgressResult extends TutorialProgress {
  loading: boolean;
  markCompleted: (tourId: TourId) => void;
  markSkipped: (tourId: TourId) => void;
  dismissTip: (tipId: string) => void;
  /** Clear everything, so a user can watch the tours again. */
  reset: () => void;
}

export function useTutorialProgress(): UseTutorialProgressResult {
  const [progress, setProgress] = useState<TutorialProgress>(EMPTY_PROGRESS);
  const [loading, setLoading] = useState(true);
  const hydrated = useRef(false);

  useEffect(() => {
    // Local first so the UI settles immediately, then reconcile with the
    // server, which wins.
    setProgress(loadLocal());

    let cancelled = false;
    fetch("/api/user/tutorial")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled || !body?.progress) return;
        const remote = body.progress as TutorialProgress;
        setProgress(remote);
        saveLocal(remote);
      })
      .catch(() => {
        // Offline or signed out — the local copy stands.
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          hydrated.current = true;
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: TutorialProgress) => {
    saveLocal(next);
    void fetch("/api/user/tutorial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {
      // Best effort. The local copy already reflects the change, and the next
      // successful write carries it.
    });
  }, []);

  const update = useCallback(
    (fn: (current: TutorialProgress) => TutorialProgress) => {
      setProgress((current) => {
        const next = fn(current);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const markCompleted = useCallback(
    (tourId: TourId) =>
      update((current) =>
        current.completed.includes(tourId)
          ? current
          : { ...current, completed: [...current.completed, tourId] },
      ),
    [update],
  );

  const markSkipped = useCallback(
    (tourId: TourId) =>
      update((current) =>
        current.skipped.includes(tourId)
          ? current
          : { ...current, skipped: [...current.skipped, tourId] },
      ),
    [update],
  );

  const dismissTip = useCallback(
    (tipId: string) =>
      update((current) =>
        current.dismissedTips.includes(tipId)
          ? current
          : { ...current, dismissedTips: [...current.dismissedTips, tipId] },
      ),
    [update],
  );

  const reset = useCallback(() => update(() => EMPTY_PROGRESS), [update]);

  return { ...progress, loading, markCompleted, markSkipped, dismissTip, reset };
}
