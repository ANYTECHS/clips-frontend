"use client";

/**
 * Offloads clip recommendation ranking to a web worker (#921) so filtering
 * and sorting a large clip list doesn't block the main thread during
 * scrolling/interaction. Falls back to computing synchronously when workers
 * aren't available (SSR, or a browser/test environment without `Worker`).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipRankingRequest, ClipRankingResponse } from "@/app/workers/clipRanking.worker";

export function useClipRanking(
  clips: { id: string; score: number }[],
  threshold: number,
): string[] {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [workerResult, setWorkerResult] = useState<string[] | null>(null);

  // The synchronous fallback also doubles as the initial value before the
  // worker's first response arrives, so there's never a flash of "no
  // recommendations" while the worker spins up.
  const syncResult = useMemo(
    () =>
      clips
        .filter((c) => c.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .map((c) => c.id),
    [clips, threshold],
  );

  useEffect(() => {
    if (typeof Worker === "undefined") return;

    const worker = new Worker(new URL("../workers/clipRanking.worker.ts", import.meta.url));
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<ClipRankingResponse>) => {
      if (event.data.requestId !== requestIdRef.current) return; // stale response
      setWorkerResult(event.data.recommendedIds);
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
    };
    worker.postMessage(request);
  }, [clips, threshold]);

  return workerRef.current ? workerResult ?? syncResult : syncResult;
}
