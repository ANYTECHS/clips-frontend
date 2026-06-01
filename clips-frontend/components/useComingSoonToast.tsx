"use client";

import { useToast } from "@/hooks/useToast";

/**
 * Convenience hook for "coming soon" notifications.
 * Delegates to the global toast system.
 *
 * @example
 * const { showToast } = useComingSoonToast();
 * showToast("Analytics");  // → "Analytics — Coming soon"
 */
export function useComingSoonToast() {
  const { info } = useToast();

  return {
    showToast: (label: string) => info(`${label} — Coming soon`),
    // Kept for backward compatibility; rendering is handled by ToastProvider
    ToastEl: null,
  };
}
