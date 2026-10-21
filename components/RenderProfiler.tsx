"use client";

/**
 * Wraps a subtree in React's `<Profiler>` and reports each commit's
 * `actualDuration` as `render.<id>` through the performance pipeline (#1180).
 *
 * Use it around subtrees suspected of re-rendering too often; pair it with a
 * `CUSTOM_METRIC_THRESHOLDS` entry so commits get rated. Only commits slower
 * than `minDurationMs` are reported, keeping the metric stream quiet.
 */

import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from "react";
import { reportMetric } from "@/app/lib/performanceMonitoring";

interface RenderProfilerProps {
  id: string;
  children: ReactNode;
  minDurationMs?: number;
}

export function RenderProfiler({ id, children, minDurationMs = 16 }: RenderProfilerProps) {
  const onRender: ProfilerOnRenderCallback = (profilerId, phase, actualDuration) => {
    if (actualDuration < minDurationMs) return;
    reportMetric(`render.${profilerId}`, actualDuration, { phase });
  };

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
