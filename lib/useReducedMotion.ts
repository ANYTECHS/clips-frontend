"use client";

import { useEffect, useState } from "react";

/**
 * Issue #1378 — prefers-reduced-motion.
 * Returns true when the OS asks for reduced motion; components should swap
 * animated transitions for instant state changes. A global CSS fallback in
 * globals.css also disables CSS animations/transitions for reduced-motion
 * users, covering class-based motion.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
