"use client";

import { useToastContext } from "@/components/ToastProvider";

/**
 * A hook that provides access to the global toast system.
 * Now powered by ToastProvider for global availability.
 */
export function useToast() {
  const { showToast, hideToast } = useToastContext();

  return { 
    showToast, 
    hideToast,
    // ToastEl is now rendered by ToastProvider, so we return null for backward compatibility
    ToastEl: null 
  };
}
