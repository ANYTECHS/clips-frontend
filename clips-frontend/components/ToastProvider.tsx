"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, Zap, Check, AlertCircle, Info } from "lucide-react";

export type ToastType = "info" | "success" | "error";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => string;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToastContext must be used within a ToastProvider");
  return context;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <Check className="w-4 h-4" />,
  error: <AlertCircle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
};

const STYLES: Record<ToastType, { border: string; icon: string }> = {
  success: { border: "border-brand/30", icon: "bg-brand/10 text-brand" },
  error: { border: "border-red-500/30", icon: "bg-red-500/10 text-red-500" },
  info: { border: "border-white/10", icon: "bg-white/5 text-white" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { border, icon } = STYLES[toast.type];
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div
        className={`bg-[#0C120F] border ${border} rounded-xl px-5 py-4 shadow-[0_0_30px_rgba(0,229,143,0.1)] backdrop-blur-md flex items-center gap-3 max-w-sm`}
        role="alert"
        aria-live="polite"
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${icon}`}>
          {ICONS[toast.type]}
        </div>
        <p className="flex-1 text-[13px] font-bold text-white">{toast.message}</p>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-[#5A6F65] hover:text-white transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration = 3000): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
      if (duration > 0) setTimeout(() => hideToast(id), duration);
      return id;
    },
    [hideToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={hideToast} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
