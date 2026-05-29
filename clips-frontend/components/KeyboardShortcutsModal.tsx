"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Keyboard } from "lucide-react";
import { SHORTCUT_REGISTRY, Shortcut } from "@/app/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(typeof window !== "undefined" && navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  useEffect(() => {
    if (isOpen) {
      returnFocusRef.current = document.activeElement as HTMLElement;
      // Small delay to ensure the modal is rendered before focusing
      const timer = setTimeout(() => {
        modalRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else if (returnFocusRef.current) {
      returnFocusRef.current.focus();
    }
  }, [isOpen]);

  // Trap focus
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const groupedShortcuts = SHORTCUT_REGISTRY.reduce((acc, shortcut) => {
    if (!acc[shortcut.section]) {
      acc[shortcut.section] = [];
    }
    acc[shortcut.section].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        tabIndex={-1}
        className="relative w-full max-w-lg bg-surface border border-white/10 rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-lg">
              <Keyboard className="w-5 h-5 text-brand" />
            </div>
            <h2 id="shortcuts-title" className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Close shortcuts modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Mobile Note */}
          <div className="lg:hidden mb-6 p-4 bg-warning/10 border border-warning/20 rounded-xl">
            <p className="text-sm text-warning font-medium">
              Note: Keyboard shortcuts are primarily for desktop use.
            </p>
          </div>

          <div className="space-y-8">
            {Object.entries(groupedShortcuts).map(([section, shortcuts]) => (
              <div key={section}>
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-4">{section}</h3>
                <div className="space-y-3">
                  {shortcuts.map((shortcut) => (
                    <div key={shortcut.key} className="flex items-center justify-between group">
                      <span className="text-sm text-white/80 group-hover:text-white transition-colors">{shortcut.description}</span>
                      <div className="flex items-center gap-1.5">
                        {shortcut.meta && (
                          <kbd className="min-w-[28px] h-7 px-2 flex items-center justify-center bg-white/5 border border-white/10 rounded-md text-[12px] font-medium text-muted">
                            {isMac ? '⌘' : 'Ctrl'}
                          </kbd>
                        )}
                        <kbd className="min-w-[28px] h-7 px-2 flex items-center justify-center bg-white/10 border border-white/20 rounded-md text-[12px] font-bold text-white">
                          {shortcut.key === " " ? "Space" : shortcut.key.toUpperCase()}
                        </kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 flex justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-xl border border-white/5 transition-all active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
