"use client";

/**
 * Frame-rate sampling for animations (#879).
 *
 * Answers "is this animation actually smooth on real hardware" rather than
 * "does it look smooth on mine". Samples frame deltas over a window and
 * reports the average FPS through the performance monitoring pipeline, so a
 * janky animation shows up in the same place as every other perf regression.
 *
 * Sampling is off by default and is opt-in per animation: measuring every
 * animation everywhere would itself cost frames.
 */

import { useCallback, useRef } from "react";
import { useAnimationFrame } from "@/app/hooks/useAnimationFrame";
import { reportMetric } from "@/app/lib/performanceMonitoring";

/** Milliseconds in one second, for the frames-per-second conversion. */
const MS_PER_SECOND = 1000;

export interface UseAnimationFrameRateOptions {
  /** Turn sampling on. Off by default so measurement is always deliberate. */
  enabled?: boolean;
  /** How many frames to average before reporting. */
  sampleSize?: number;
  /** Report at most one sample, then stop — for one-shot animations. */
  once?: boolean;
}

/**
 * Samples frame rate while `enabled`, reporting `animation.fps.<name>`.
 *
 * The metric carries no budget by default, so samples are recorded without a
 * rating; add one to `CUSTOM_METRIC_THRESHOLDS` to have breaches alert.
 */
export function useAnimationFrameRate(
  name: string,
  {
    enabled = false,
    sampleSize = 60,
    once = false,
  }: UseAnimationFrameRateOptions = {},
): void {
  const framesRef = useRef(0);
  const elapsedRef = useRef(0);
  const reportedRef = useRef(false);

  const onFrame = useCallback(
    (deltaMs: number) => {
      if (once && reportedRef.current) return;

      framesRef.current += 1;
      elapsedRef.current += deltaMs;

      if (framesRef.current < sampleSize) return;

      // Guard against a zero window: a paused-then-resumed loop can deliver a
      // burst of frames with no measurable elapsed time.
      if (elapsedRef.current > 0) {
        const fps = (framesRef.current * MS_PER_SECOND) / elapsedRef.current;
        reportMetric(`animation.fps.${name}`, fps, { frames: framesRef.current });
        reportedRef.current = true;
      }

      framesRef.current = 0;
      elapsedRef.current = 0;
    },
    [name, sampleSize, once],
  );

  useAnimationFrame(onFrame, { enabled });
}
