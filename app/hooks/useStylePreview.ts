"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnimeTransformOptions } from "@/app/lib/animeTransform";

export interface UseStylePreviewOptions {
  clipId: string | null | undefined;
  style: string | null | undefined;
  intensity?: number;
  transformOptions?: Record<string, unknown> | AnimeTransformOptions;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseStylePreviewResult {
  previewUrl: string | null;
  sourceUrl: string | null;
  estimatedSeconds: number | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  cancel: () => void;
}

const DEFAULT_DEBOUNCE_MS = 700;

export function useStylePreview({
  clipId,
  style,
  intensity = 70,
  transformOptions = {},
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseStylePreviewOptions): UseStylePreviewResult {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [estimatedSeconds, setEstimatedSeconds] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsLoading(false);
    setError(null);
  }, []);

  const fetchPreview = useCallback(async () => {
    if (!clipId || !style || !enabled) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/transform/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId,
          style,
          intensity,
          transformOptions,
        }),
        signal: controller.signal,
      });

      if (requestId !== requestIdRef.current) return;
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Preview request failed (HTTP ${response.status})`);
      }

      const body = (await response.json()) as {
        previewUrl?: string;
        sourceUrl?: string;
        estimatedSeconds?: number;
      };
      if (!body.previewUrl) throw new Error("No preview URL in response");
      if (requestId !== requestIdRef.current) return;

      setPreviewUrl(body.previewUrl);
      setSourceUrl(body.sourceUrl ?? null);
      setEstimatedSeconds(body.estimatedSeconds ?? null);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unable to generate preview");
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        controllerRef.current = null;
      }
    }
  }, [clipId, enabled, intensity, style, transformOptions]);

  useEffect(() => {
    if (!enabled || !clipId || !style) {
      void Promise.resolve().then(() => {
        cancel();
        setPreviewUrl(null);
        setSourceUrl(null);
        setEstimatedSeconds(null);
      });
      return undefined;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void fetchPreview();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      controllerRef.current?.abort();
    };
  }, [cancel, clipId, debounceMs, enabled, fetchPreview, style]);

  useEffect(() => cancel, [cancel]);

  return {
    previewUrl,
    sourceUrl,
    estimatedSeconds,
    isLoading,
    error,
    refresh: () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void fetchPreview();
    },
    cancel,
  };
}
