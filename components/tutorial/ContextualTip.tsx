"use client";

/**
 * Contextual tooltip (Issue #1065).
 *
 * A tour explains a screen once; a tip explains one control at the moment
 * someone meets it, and stays dismissed afterwards.
 *
 * Dismissal is per-tip and persisted, because the alternative — a tip that
 * returns on the next visit — is the pattern users learn to close without
 * reading, which makes every later tip worthless too.
 */

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { useTutorial } from "./TutorialProvider";

export interface ContextualTipProps {
  /** Stable id. Changing it re-shows the tip to everyone. */
  id: string;
  title: string;
  body: string;
  children: React.ReactNode;
  /** Show the tip immediately rather than behind the help affordance. */
  defaultOpen?: boolean;
}

export default function ContextualTip({
  id,
  title,
  body,
  children,
  defaultOpen = false,
}: ContextualTipProps) {
  const { dismissTip, isTipDismissed } = useTutorial();
  const dismissed = isTipDismissed(id);
  const [open, setOpen] = useState(defaultOpen && !dismissed);

  return (
    <span className="relative inline-flex items-center gap-1.5">
      {children}

      {!dismissed && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`What is ${title}?`}
          aria-expanded={open}
          className="text-white/40 transition-colors hover:text-brand"
        >
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {open && !dismissed && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-surface p-3 text-left shadow-2xl"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="text-xs font-bold text-white">{title}</span>
            <button
              type="button"
              onClick={() => {
                // Closing the tip is what marks it read — a tip the user
                // opened and closed has done its job.
                dismissTip(id);
                setOpen(false);
              }}
              aria-label="Dismiss this tip"
              className="-mr-0.5 -mt-0.5 text-white/40 transition-colors hover:text-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-white/60">{body}</span>
        </span>
      )}
    </span>
  );
}
