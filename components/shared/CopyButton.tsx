"use client";

import React from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";

interface CopyButtonProps {
  /** Text placed on the clipboard. */
  value: string;
  /** Accessible name, e.g. "Copy API key". */
  label?: string;
  /** Toast shown on success. */
  successMessage?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Copy button with visible + audible confirmation: swaps to a checkmark for 2s,
 * shows a toast, and announces "Copied" through a polite live region.
 */
export default function CopyButton({
  value,
  label = "Copy to clipboard",
  successMessage = "Copied to clipboard",
  className = "",
  children,
}: CopyButtonProps) {
  const { toast } = useToast();
  const { copied, copy } = useCopyToClipboard();

  const handleClick = async () => {
    if (await copy(value)) toast(successMessage, "success");
    else toast("Couldn't copy to clipboard", "error");
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        className={`inline-flex items-center gap-1.5 text-[#B6FF4A] hover:text-[#F4F7EF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B6FF4A]/60 rounded ${className}`}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        {children}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}
