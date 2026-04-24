"use client";

import React, { useState, useCallback } from "react";
import { X, Zap } from "lucide-react";

interface ToastState {
  visible: boolean;
  label: string;
}

/**
 * Returns a { showToast, ToastEl } pair.
 * Call showToast(label) to display a "Coming soon" notification.
 * Render <ToastEl /> anywhere in the component tree.
 */
export function useComingSoonToast() {
  const [toast, setToast] = useState<ToastState>({ visible: false, label: "" });

  const showToast = useCallback((label: string) => {
    setToast({ visible: true, label });
    setTimeout(() => setToast({ visible: false, label: "" }), 3000);
  }, []);

  const ToastEl = toast.visible ? (
    <div className="fixed bottom-6 right-6 z-[200] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-[#0C120F] border border-brand/30 rounded-xl px-5 py-4 shadow-[0_0_30px_rgba(0,229,143,0.2)] backdrop-blur-md flex items-center gap-3 max-w-sm">
        <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-brand fill-brand" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-bold text-white">{toast.label} — Coming soon</p>
          <p className="text-[11px] text-[#5A6F65] mt-0.5">We&apos;re working on something awesome!</p>
        </div>
        <button
          onClick={() => setToast({ visible: false, label: "" })}
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
