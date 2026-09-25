"use client";

/**
 * Tutorial orchestration (Issue #1065).
 *
 * Owns which tour is running and exposes the controls any component can use to
 * start one — a "Show me around" link in settings, a first-visit auto-start, a
 * contextual prompt after a first upload.
 *
 * # Why only one tour runs at a time
 *
 * Two spotlights competing for the same screen is not a state worth
 * supporting. Starting a tour replaces whatever was running.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import FeatureTour from "./FeatureTour";
import { getTour } from "@/app/lib/tutorial/tours";
import { shouldAutoStart } from "@/app/lib/tutorial/types";
import type { TourId, TutorialProgress } from "@/app/lib/tutorial/types";
import { useTutorialProgress } from "@/app/hooks/useTutorialProgress";

interface TutorialContextValue extends TutorialProgress {
  activeTourId: TourId | null;
  startTour: (tourId: TourId) => void;
  stopTour: () => void;
  dismissTip: (tipId: string) => void;
  /** Clear all progress so the tours can be watched again. */
  resetTutorials: () => void;
  isTipDismissed: (tipId: string) => boolean;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return ctx;
}

export interface TutorialProviderProps {
  children: React.ReactNode;
  /**
   * Tour to offer to a user who has neither completed nor skipped it.
   * Omit to disable auto-start entirely.
   */
  autoStart?: TourId;
}

export default function TutorialProvider({ children, autoStart }: TutorialProviderProps) {
  const {
    completed,
    skipped,
    dismissedTips,
    loading,
    markCompleted,
    markSkipped,
    dismissTip,
    reset,
  } = useTutorialProgress();

  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);

  const startTour = useCallback((tourId: TourId) => setActiveTourId(tourId), []);
  const stopTour = useCallback(() => setActiveTourId(null), []);

  // Wait for progress to load before auto-starting: firing on the default
  // empty progress would show a completed tour again on every hard refresh.
  useEffect(() => {
    if (loading || !autoStart || activeTourId) return;
    if (shouldAutoStart({ completed, skipped, dismissedTips }, autoStart)) {
      setActiveTourId(autoStart);
    }
  }, [loading, autoStart, activeTourId, completed, skipped, dismissedTips]);

  const handleComplete = useCallback(() => {
    if (activeTourId) markCompleted(activeTourId);
    setActiveTourId(null);
  }, [activeTourId, markCompleted]);

  const handleSkip = useCallback(() => {
    if (activeTourId) markSkipped(activeTourId);
    setActiveTourId(null);
  }, [activeTourId, markSkipped]);

  const isTipDismissed = useCallback(
    (tipId: string) => dismissedTips.includes(tipId),
    [dismissedTips],
  );

  const value = useMemo<TutorialContextValue>(
    () => ({
      completed,
      skipped,
      dismissedTips,
      activeTourId,
      startTour,
      stopTour,
      dismissTip,
      resetTutorials: reset,
      isTipDismissed,
    }),
    [
      completed,
      skipped,
      dismissedTips,
      activeTourId,
      startTour,
      stopTour,
      dismissTip,
      reset,
      isTipDismissed,
    ],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {activeTourId && (
        <FeatureTour
          tour={getTour(activeTourId)}
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      )}
    </TutorialContext.Provider>
  );
}
