"use client";

import { useToastContext } from "@/components/ToastProvider";

/**
 * Reusable toast hook. Provides typed helpers for success, error, and info toasts.
 * All toasts are rendered globally by ToastProvider in the root layout.
 *
 * @example
 * const { success, error, info } = useToast();
 * success("Clip saved!");
 * error("Upload failed.");
 * info("Processing started.");
 */
export function useToast() {
  const { showToast, hideToast } = useToastContext();

  return {
    showToast,
    hideToast,
    success: (message: string, duration?: number) => showToast(message, "success", duration),
    error: (message: string, duration?: number) => showToast(message, "error", duration),
    info: (message: string, duration?: number) => showToast(message, "info", duration),
    // Kept for backward compatibility
    ToastEl: null,
  };
}
