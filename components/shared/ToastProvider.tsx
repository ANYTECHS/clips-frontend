"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, Info, Loader2 } from "lucide-react";

type ToastType = "success" | "error" | "info" | "loading";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (type !== "loading") {
      setTimeout(() => {
        removeToast(id);
      }, 5000);
    }

    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 w-full max-w-[380px] pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-brand" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
    loading: <Loader2 className="w-5 h-5 text-brand animate-spin" />,
  };

  const bgClasses = {
    success: "bg-brand/10 border-brand/20 shadow-[0_0_20px_rgba(0,229,143,0.1)]",
    error: "bg-red-400/10 border-red-400/20 shadow-[0_0_20px_rgba(248,113,113,0.1)]",
    info: "bg-blue-400/10 border-blue-400/20 shadow-[0_0_20px_rgba(96,165,250,0.1)]",
    loading: "bg-white/5 border-white/10 shadow-2xl",
  };

  return (
    <div className={`pointer-events-auto flex items-center gap-3 px-4 py-4 rounded-2xl border backdrop-blur-md animate-in slide-in-from-right-full duration-300 ${bgClasses[toast.type]}`}>
      <div className="shrink-0">{icons[toast.type]}</div>
      <p className="text-[14px] font-medium text-white flex-1 leading-tight">{toast.message}</p>
      <button onClick={onRemove} className="shrink-0 p-1 text-white/40 hover:text-white transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
