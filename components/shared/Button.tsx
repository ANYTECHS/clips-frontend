"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export const BUTTON_VARIANTS = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "danger",
  "link",
] as const;
export const BUTTON_SIZES = ["sm", "md", "lg", "icon"] as const;

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];
export type ButtonSize = (typeof BUTTON_SIZES)[number];

const base =
  "inline-flex items-center justify-center gap-2 font-bold transition-all select-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B6FF4A]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020D08] " +
  "disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] font-black shadow-[0_0_20px_rgba(57,255,20,0.25)] hover:shadow-[0_0_30px_rgba(57,255,20,0.4)]",
  secondary:
    "bg-[#06351C] hover:bg-[#084223] text-[#F4F7EF] border border-[#0e4d2a] hover:border-[#39FF14]/40",
  outline:
    "bg-transparent hover:bg-[#B6FF4A]/10 text-[#B6FF4A] border border-[#B6FF4A]/40 hover:border-[#B6FF4A]",
  // Issue #1376 — ghost text bumped to #DCE8E0 (~7:1 on #020D08/#042413)
  // to meet WCAG AA 4.5:1; #90A89C measured ~3.8:1 and failed.
  ghost: "bg-transparent hover:bg-white/5 text-[#DCE8E0] hover:text-[#F4F7EF]",
  danger:
    "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/60",
  link: "bg-transparent text-[#B6FF4A] hover:underline px-0 py-0 h-auto active:scale-100",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[12px] rounded-lg",
  md: "px-4 py-2.5 text-[13px] sm:text-[14px] rounded-xl",
  lg: "px-6 py-3.5 text-[15px] rounded-[14px]",
  icon: "p-2 rounded-lg",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  fullWidth?: boolean;
}

/**
 * Shared button. `size="icon"` buttons must provide an `aria-label`.
 * `type` is passed through untouched (native default is "submit" inside a form), so set
 * `type="button"` explicitly for non-submitting buttons in forms.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    className = "",
    disabled,
    type,
    children,
    ...rest
  },
  ref
) {
  const sizeClass = variant === "link" ? "text-[13px]" : sizeClasses[size].replace("", "");
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${variantClasses[variant]} ${sizeClass} ${fullWidth ? "w-full" : ""} ${className}`.trim()}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});

export default Button;
