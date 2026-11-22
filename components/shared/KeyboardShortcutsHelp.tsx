"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SHORTCUTS } from "@/lib/keyboardShortcuts";
import { useFocusTrap } from "@/lib/useFocusTrap";

/**
 * Issue #1377 — keyboard shortcuts help overlay.
 * Press "?" (Shift+/) anywhere to open; Escape or backdrop click closes.
 * Announced to screen readers via role="dialog" + aria-modal + a live-region
 * title. Shortcuts are grouped by category.
 */
export default function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;
      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }
      // "?" = Shift+/ on US layouts; also accept literal "?".
      if (!typing && e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-help-title"
        className="w-full max-w-[520px] max-h-[80vh] overflow-y-auto bg-[#06351C] border border-[#0e4d2a] rounded-[20px] p-6 shadow-[0_4px_40px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="shortcuts-help-title" className="text-[20px] font-extrabold text-[#F4F7EF]">
            Keyboard shortcuts
          </h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close shortcuts help"
            className="p-2 rounded-lg text-[#90A89C] hover:text-[#F4F7EF] hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {SHORTCUTS.map((group) => (
            <section key={group.category} aria-label={group.category}>
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#B6FF4A] mb-2">
                {group.category}
              </h3>
              <ul className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <li key={s.keys + s.description} className="flex items-center justify-between gap-4">
                    <span className="text-[13px] text-[#F4F7EF]">{s.description}</span>
                    <kbd className="shrink-0 px-2 py-0.5 rounded-md bg-[#042413] border border-[#0e4d2a] text-[11px] font-mono text-[#B6FF4A]">
                      {s.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-5 text-[12px] text-[#90A89C]">
          Press <kbd className="px-1 rounded bg-[#042413] border border-[#0e4d2a] font-mono">?</kbd> or{" "}
          <kbd className="px-1 rounded bg-[#042413] border border-[#0e4d2a] font-mono">Esc</kbd> to close.
        </p>
      </div>
    </div>
  );
}
