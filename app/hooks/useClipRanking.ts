"use client";

/**
 * Offloads clip recommendation ranking to a web worker (#921) so filtering
 * and sorting a large clip list doesn't block the main thread during
 * scrolling/interaction. Falls back to computing synchronously when workers
 * aren't available (SSR, or a browser/test environment without `Worker`).
 *
 * Ranking criteria are weighted by the creator's preferences: `setWeights`
 * and `applyPreset` update the worker's criteria and persist the choice via
 * `RankingPreferenceStorage` so it survives reloads. Re-sorts caused by a
 * weight change run inside a View Transition (where supported) so cards glide
 * to their new positions instead of jumping.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  rankClips,
  resolveRankingWeights,
  type ClipRankingResult,
  type RankableClip,
  type RankingWeights,
} from "@/app/lib/clipRanking";
import {
  DEFAULT_USER_PREFERENCES,
  RANKING_WEIGHT_PRESETS,
  RankingPreferenceStorage,
  type RankingPreferences,
  type RankingPresetId,
} from "@/app/lib/userPreferences";
import type { ClipRankingRequest, ClipRankingResponse } from "@/app/workers/clipRanking.worker";

export interface UseClipRankingResult extends ClipRankingResult {
  weights: RankingWeights;
  preset: RankingPreferences["preset"];
  /** Update one or more criteria weights; marks the preset as "custom". */
  setWeights: (weights: Partial<RankingWeights>) => void;
  /** Switch to a built-in weight preset. */
  applyPreset: (presetId: RankingPresetId) => void;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

/** Run a state update inside a View Transition when supported and motion is allowed. */
function withViewTransition(update: () => void): void {
  const doc =
    typeof document !== "undefined" ? (document as ViewTransitionDocument) : null;
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (!doc?.startViewTransition || reduceMotion) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}

export function useClipRanking(clips: RankableClip[], threshold: number): UseClipRankingResult {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  // Set when the next worker response is the result of a weight change, so
  // only creator-driven re-sorts animate (not every clip-list refresh).
  const animateNextRef = useRef(false);
  const [workerResult, setWorkerResult] = useState<ClipRankingResult | null>(null);
  const [ranking, setRanking] = useState<RankingPreferences>(DEFAULT_USER_PREFERENCES.ranking);

  // Persisted weights live in localStorage, so read them after mount to keep
  // the server render and the first client render identical.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRanking(RankingPreferenceStorage.get());
  }, []);

  const weights = ranking.weights;

  // The synchronous fallback also doubles as the initial value before the
  // worker's first response arrives, so there's never a flash of "no
  // recommendations" while the worker spins up.
  const syncResult = useMemo(
    () => rankClips(clips, weights, threshold),
    [clips, weights, threshold],
  );

  useEffect(() => {
    if (typeof Worker === "undefined") return;

    const worker = new Worker(new URL("../workers/clipRanking.worker.ts", import.meta.url));
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<ClipRankingResponse>) => {
      if (event.data.requestId !== requestIdRef.current) return; // stale response
      const { rankedIds, recommendedIds, details } = event.data;
      const apply = () => setWorkerResult({ rankedIds, recommendedIds, details });
      if (animateNextRef.current) {
        animateNextRef.current = false;
        withViewTransition(apply);
      } else {
        apply();
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    requestIdRef.current += 1;
    const request: ClipRankingRequest = {
      requestId: requestIdRef.current,
      clips,
      threshold,
      weights,
    };
    worker.postMessage(request);
  }, [clips, threshold, weights]);

  const updateRanking = useCallback((next: RankingPreferences) => {
    RankingPreferenceStorage.set(next);
    if (workerRef.current) {
      // The worker's response carries the re-sort; animate that one.
      animateNextRef.current = true;
      setRanking(next);
    } else {
      withViewTransition(() => setRanking(next));
    }
  }, []);

  const setWeights = useCallback(
    (patch: Partial<RankingWeights>) => {
      updateRanking({
        preset: "custom",
        weights: resolveRankingWeights({ ...ranking.weights, ...patch }),
      });
    },
    [ranking.weights, updateRanking],
  );

  const applyPreset = useCallback(
    (presetId: RankingPresetId) => {
      updateRanking({
        preset: presetId,
        weights: { ...RANKING_WEIGHT_PRESETS[presetId].weights },
      });
    },
    [updateRanking],
  );

  const result = workerRef.current ? workerResult ?? syncResult : syncResult;

  return {
    ...result,
    weights,
    preset: ranking.preset,
    setWeights,
    applyPreset,
  };
}
