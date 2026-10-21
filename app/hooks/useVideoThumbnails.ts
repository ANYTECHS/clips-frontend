"use client";

/**
 * useVideoThumbnails
 *
 * Manages thumbnail generation state for a list of File objects.
 *
 * - Kicks off generation as soon as files are added.
 * - Tracks loading / thumbnails / error per file.
 * - Reads from the module-level cache in videoThumbnail.ts so refreshes
 *   and re-renders never regenerate existing thumbnails.
 * - Cleans up cache entries when files are removed.
 * - Dispatches frame encoding to a web worker (app/workers/thumbnailWorker.ts)
 *   shared by every file, so generation never blocks the main thread and
 *   several files can be processed in parallel. Falls back to main-thread
 *   extraction where workers / OffscreenCanvas are unavailable.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createThumbnailWorker,
  evictThumbnailCache,
  generateVideoThumbnails,
  type ThumbnailWorkerClient,
} from "@/app/lib/videoThumbnail";

export type ThumbnailStatus = "idle" | "loading" | "ready" | "error";

export type FileThumbnailState = {
  status: ThumbnailStatus;
  thumbnails: string[];
  error?: string;
};

export type ThumbnailMap = Record<string, FileThumbnailState>;

/** Seek positions: start (~5%), middle (50%), end (~95%). */
const SEEK_POSITIONS = [0.05, 0.5, 0.95];

const DEFAULT_STATE: FileThumbnailState = { status: "idle", thumbnails: [] };

export function useVideoThumbnails(files: File[]): ThumbnailMap {
  const [thumbnailMap, setThumbnailMap] = useState<ThumbnailMap>({});

  // Track which files we've already started generating so we don't double-fire.
  const inProgress = useRef<Set<string>>(new Set());

  // One worker per hook instance, created lazily and terminated on unmount.
  // `undefined` means "not tried yet"; `null` means "unsupported, use main thread".
  const workerRef = useRef<ThumbnailWorkerClient | null | undefined>(undefined);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = undefined;
    };
  }, []);

  const setFileState = useCallback(
    (name: string, patch: Partial<FileThumbnailState>) => {
      setThumbnailMap((prev: ThumbnailMap) => ({
        ...prev,
        [name]: { ...(prev[name] ?? DEFAULT_STATE), ...patch },
      }));
    },
    [],
  );

  // Generate thumbnails for any newly added files.
  useEffect(() => {
    for (const file of files) {
      if (inProgress.current.has(file.name)) continue;

      if (workerRef.current === undefined) {
        workerRef.current = createThumbnailWorker();
      }

      inProgress.current.add(file.name);
      setFileState(file.name, { status: "loading", thumbnails: [] });

      generateVideoThumbnails(file, SEEK_POSITIONS, { worker: workerRef.current })
        .then((thumbnails: string[]) => {
          setFileState(file.name, { status: "ready", thumbnails });
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Thumbnail generation failed";
          setFileState(file.name, { status: "error", thumbnails: [], error: message });
        });
    }
  }, [files, setFileState]);

  // Clean up state for files removed from the queue.
  const fileNamesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const fileNames = new Set(files.map((f: File) => f.name));
    fileNamesRef.current = fileNames;

    setThumbnailMap((prev: ThumbnailMap) => {
      const next: ThumbnailMap = {};
      for (const name of Object.keys(prev)) {
        if (fileNames.has(name)) {
          next[name] = prev[name] as FileThumbnailState;
        }
      }
      return next;
    });

    for (const name of inProgress.current) {
      if (!fileNames.has(name)) {
        inProgress.current.delete(name);
      }
    }
  }, [files]);

  // Evict thumbnail cache when files are removed (needs the File object).
  const prevFilesRef = useRef<File[]>([]);
  useEffect(() => {
    const removed = prevFilesRef.current.filter(
      (f: File) => !files.some((cur: File) => cur.name === f.name),
    );
    for (const f of removed) {
      evictThumbnailCache(f);
    }
    prevFilesRef.current = files;
  }, [files]);

  return thumbnailMap;
}
