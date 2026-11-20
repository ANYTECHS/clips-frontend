"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const COPY_FEEDBACK_MS = 2000;

/**
 * Copies text and exposes `copied`, which reverts to false after 2 seconds.
 * Resolves true on success so callers can show a toast.
 */
export function useCopyToClipboard(resetMs: number = COPY_FEEDBACK_MS) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        if (typeof navigator === "undefined" || !navigator.clipboard) return false;
        await navigator.clipboard.writeText(text);
      } catch {
        return false;
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetMs);
      return true;
    },
    [resetMs]
  );

  return { copied, copy };
}
