"use client";

import React, { useState, useCallback } from "react";
import { X, Zap, Check, AlertCircle } from "lucide-react";

export type ToastType = "info" | "success" | "error";

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
}

/**
 * A flexible toast hook that can be used for success, error, and info notifications.
 * Render <ToastEl /> at the root of your component.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "info",
  });

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ visible: true, message, type });
    // Auto-hide after 3 seconds
    setTimeout(() => setToast((prev: ToastState) => ({ ...prev, visible: false })), 3000);
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev: ToastState) => ({ ...prev, visible: false }));
  }, []);

  const ToastEl = toast.visible ? (
    <div className="fixed bottom-6 right-6 z-[200] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div
        className={`bg-[#0C120F] border rounded-xl px-5 py-4 shadow-[0_0_30px_rgba(0,229,143,0.1)] backdrop-blur-md flex items-center gap-3 max-w-sm ${
          toast.type === "success"
            ? "border-brand/30"
            : toast.type === "error"
            ? "border-red-500/30"
            : "border-white/10"
        }`}
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            toast.type === "success"
              ? "bg-brand/10 text-brand"
              : toast.type === "error"
              ? "bg-red-500/10 text-red-500"
              : "bg-white/5 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <Check className="w-4 h-4" />
          ) : toast.type === "error" ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <Zap className="w-4 h-4 fill-current" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-bold text-white">{toast.message}</p>
          {toast.type === "info" && (
            <p className="text-[11px] text-[#5A6F65] mt-0.5">
              We&apos;re working on something awesome!
            </p>
          )}
        </div>
        <button
          onClick={hideToast}
          className="text-[#5A6F65] hover:text-white transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  ) : null;

  return { showToast, ToastEl };
}
