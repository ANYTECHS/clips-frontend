"use client";

import React, { useEffect } from "react";
import { AlertCircle, Trash2 } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "info";
  loading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "info",
  loading = false,
}: ConfirmModalProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        className="relative w-full max-w-md bg-[#06351C] border border-[#0e4d2a] rounded-[32px] p-8 shadow-[0_0_80px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-300 overflow-hidden">
        {/* subtle glow */}
        <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[60px] pointer-events-none ${variant === 'danger' ? 'bg-red-500/10' : 'bg-[#39FF14]/10'}`} />

        <div className="flex flex-col items-center text-center space-y-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${variant === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-[#042413] border border-[#0e4d2a] text-[#B6FF4A]'}`}>
            {variant === 'danger' ? <Trash2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
          </div>

          <div className="space-y-2">
            <h3 id="confirm-modal-title" className="text-2xl font-bold text-[#F4F7EF] tracking-tight">{title}</h3>
            <p id="confirm-modal-message" className="text-[#90A89C] leading-relaxed">{message}</p>
          </div>

          <div className="flex gap-3 w-full pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-4 rounded-2xl bg-[#042413] hover:bg-[#084223] text-[#F4F7EF] border border-[#0e4d2a] font-bold transition-all disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-6 py-4 rounded-2xl font-black transition-all active:scale-[0.98] disabled:opacity-50 ${
                variant === 'danger' 
                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20' 
                  : 'bg-[#B6FF4A] text-[#020D08] hover:bg-[#c6ff6b] shadow-[0_0_20px_rgba(57,255,20,0.25)]'
              }`}
            >
              {loading ? "Processing..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
