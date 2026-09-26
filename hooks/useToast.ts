"use client";

import React, { useState, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export interface UseToastReturn {
  /** Show a toast message. Defaults to "info" type. */
  showToast: (message: string, type?: ToastType) => void;
  /** The toast container element to render in your component tree. */
  ToastEl: React.ReactElement;
}

// ─── Colour map ───────────────────────────────────────────────────────────────

const TYPE_CLASSES: Record<ToastType, string> = {
  success: "bg-green-600 border-green-500/40",
  error: "bg-red-600 border-red-500/40",
  warning: "bg-yellow-600 border-yellow-500/40",
  info: "bg-slate-700 border-white/10",
};

const AUTO_DISMISS_MS = 4_000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Self-contained toast hook.
 *
 * Renders the toast list inline — no context provider required.
 * Toasts auto-dismiss after 4 s.
 *
 * @example
 * ```tsx
 * const { showToast, ToastEl } = useToast();
 * // in JSX:
 * return <>{content}{ToastEl}</>;
 * ```
 */
export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timerRefs.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerRefs.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);

      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timerRefs.current.delete(id);
      }, AUTO_DISMISS_MS);

      timerRefs.current.set(id, timer);
    },
    [],
  );

  const ToastEl = React.createElement(
    "div",
    {
      "aria-live": "polite",
      "aria-atomic": "false",
      className:
        "fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none",
    },
    toasts.map((toast) =>
      React.createElement(
        "div",
        {
          key: toast.id,
          role: toast.type === "error" ? "alert" : "status",
          className: [
            "pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl",
            "border shadow-xl text-sm font-medium text-white max-w-xs",
            "animate-in slide-in-from-right-4 duration-200",
            TYPE_CLASSES[toast.type],
          ].join(" "),
        },
        React.createElement(
          "span",
          { className: "flex-1 leading-snug" },
          toast.message,
        ),
        React.createElement(
          "button",
          {
            onClick: () => dismiss(toast.id),
            "aria-label": "Dismiss notification",
            className:
              "shrink-0 text-white/60 hover:text-white transition-colors text-xs",
          },
          "✕",
        ),
      ),
    ),
  );

  return { showToast, ToastEl };
}
