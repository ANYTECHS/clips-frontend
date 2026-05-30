"use client";

import { useEffect } from "react";
import { useToast } from "@/hooks/useToast";

/**
 * Listens for "rate-limit-exceeded" custom events and surfaces them
 * via the global toast system.
 */
export default function RateLimitToast() {
  const { error } = useToast();

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      error(e.detail?.message || "Rate limit exceeded. Please slow down.", 4000);
    };
    window.addEventListener("rate-limit-exceeded", handler as EventListener);
    return () => window.removeEventListener("rate-limit-exceeded", handler as EventListener);
  }, [error]);

  return null;
}
