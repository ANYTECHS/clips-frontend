import React from "react";

interface FieldErrorProps {
  /** Id referenced by the field's `aria-describedby`. */
  id: string;
  message?: string | null;
  /** Replaces the default error styling when the message is visible. */
  className?: string;
}

/**
 * Inline validation error that screen readers announce immediately.
 * The live region stays mounted (even when empty) so insertions are reliably announced.
 */
export default function FieldError({ id, message, className }: FieldErrorProps) {
  return (
    <div
      id={id}
      role="alert"
      aria-live="assertive"
      className={message ? className || "text-[13px] text-red-400" : "sr-only"}
    >
      {message || ""}
    </div>
  );
}

/** aria props for a field that may be invalid. Spread onto the <input>/<select>. */
export function fieldErrorProps(errorId: string, invalid: boolean) {
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? errorId : undefined,
  } as const;
}
