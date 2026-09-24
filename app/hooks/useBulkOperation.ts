/**
 * app/hooks/useBulkOperation.ts
 *
 * Runs a bulk action in chunks and reports progress (Issue #1059).
 *
 * # Why chunked
 *
 * The bulk endpoints cap a request at 100 ids. More than that has to be split,
 * and splitting is also what makes progress meaningful: a single request for
 * 400 clips is a spinner that either finishes or does not, while four requests
 * of 100 give the user a bar that moves and a partial result if something
 * fails halfway.
 *
 * # Partial failure is the normal case
 *
 * Bulk platform posting talks to four external APIs per clip, and some of them
 * will reject. Treating the whole operation as failed because one clip did
 * would throw away the work that succeeded, so each chunk's failures are
 * collected and reported alongside the successes. The caller decides whether a
 * partial result is worth surfacing as an error.
 */

"use client";

import { useCallback, useRef, useState } from "react";

/** Default ids per request — matches the server-side cap on bulk endpoints. */
export const BULK_CHUNK_SIZE = 100;

export interface BulkFailure {
  clipId: string;
  error: string;
}

export interface BulkProgress {
  /** Ids processed so far, successes and failures alike. */
  processed: number;
  total: number;
  /** 0–100, rounded. 0 when nothing has been queued. */
  percent: number;
  succeeded: number;
  failures: BulkFailure[];
  isRunning: boolean;
  /** Set when the whole operation failed, not when individual ids did. */
  error: string | null;
  /** True once a run has finished, successfully or not. */
  isComplete: boolean;
}

const IDLE: BulkProgress = {
  processed: 0,
  total: 0,
  percent: 0,
  succeeded: 0,
  failures: [],
  isRunning: false,
  error: null,
  isComplete: false,
};

/** What one chunk request reports back. */
export interface ChunkResult {
  succeeded: number;
  failures?: BulkFailure[];
}

export type ChunkRunner = (clipIds: string[]) => Promise<ChunkResult>;

export interface UseBulkOperation {
  progress: BulkProgress;
  run: (clipIds: readonly string[], runner: ChunkRunner) => Promise<BulkProgress>;
  /** Stops after the in-flight chunk. Completed chunks are not rolled back. */
  cancel: () => void;
  reset: () => void;
}

export function useBulkOperation(chunkSize: number = BULK_CHUNK_SIZE): UseBulkOperation {
  const [progress, setProgress] = useState<BulkProgress>(IDLE);
  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setProgress(IDLE);
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const run = useCallback(
    async (clipIds: readonly string[], runner: ChunkRunner): Promise<BulkProgress> => {
      cancelledRef.current = false;

      const total = clipIds.length;
      let processed = 0;
      let succeeded = 0;
      const failures: BulkFailure[] = [];

      const publish = (extra: Partial<BulkProgress> = {}): BulkProgress => {
        const snapshot: BulkProgress = {
          processed,
          total,
          percent: total === 0 ? 0 : Math.round((processed / total) * 100),
          succeeded,
          failures: [...failures],
          isRunning: true,
          error: null,
          isComplete: false,
          ...extra,
        };
        setProgress(snapshot);
        return snapshot;
      };

      if (total === 0) {
        return publish({ isRunning: false, isComplete: true });
      }

      publish();

      for (let start = 0; start < total; start += chunkSize) {
        if (cancelledRef.current) break;

        const chunk = clipIds.slice(start, start + chunkSize);

        try {
          const result = await runner([...chunk]);
          succeeded += result.succeeded;
          if (result.failures?.length) failures.push(...result.failures);
        } catch (err) {
          // A transport-level failure means we cannot tell which ids in this
          // chunk landed, so every one is recorded as failed. Overreporting
          // beats claiming a success we cannot see.
          const message = err instanceof Error ? err.message : "Request failed";
          chunk.forEach((clipId) => failures.push({ clipId, error: message }));
        }

        processed += chunk.length;
        publish();
      }

      return publish({
        isRunning: false,
        isComplete: true,
        error: cancelledRef.current ? "Cancelled" : null,
      });
    },
    [chunkSize],
  );

  return { progress, run, cancel, reset };
}

/**
 * Turns a bulk API response into a {@link ChunkResult}.
 *
 * The bulk endpoints answer with `{ data: { updatedCount, errors } }`. This
 * normalises that — and a non-2xx response — into the shape `run` expects, so
 * every caller reports failures the same way.
 */
export async function chunkResultFromResponse(
  response: Response,
  clipIds: readonly string[],
): Promise<ChunkResult> {
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Non-JSON error page — keep the status-code message.
    }
    return {
      succeeded: 0,
      failures: clipIds.map((clipId) => ({ clipId, error: message })),
    };
  }

  const body = (await response.json()) as {
    data?: { updatedCount?: number; deletedCount?: number; errors?: BulkFailure[] };
  };

  const succeeded = body.data?.updatedCount ?? body.data?.deletedCount ?? clipIds.length;

  return { succeeded, failures: body.data?.errors ?? [] };
}
