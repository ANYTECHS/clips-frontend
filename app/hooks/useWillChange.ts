"use client";

/**
 * Scopes `will-change` to the lifetime of an animation instead of leaving it
 * set permanently.
 *
 * Leaving `will-change` on an element forces the browser to keep it
 * promoted to its own compositor layer indefinitely, which costs GPU memory
 * for no benefit once the animation is done. This hook sets `will-change`
 * on mount (right as a one-shot enter animation — e.g. a Tailwind
 * `animate-in` class — starts) and clears it as soon as the
 * animation/transition ends, with a timeout fallback in case neither event
 * fires (the animation is interrupted, or the element has none at all).
 *
 * For repeated, hover-triggered transforms (a card that scales on
 * `:hover`), prefer the CSS-only pattern instead — add a
 * `hover:will-change-transform` / `group-hover:will-change-transform`
 * class so the browser only promotes the layer while the pointer is
 * actually over it. See docs/will-change-guidelines.md.
 */

import { useEffect, useRef } from "react";

export function useWillChange<T extends HTMLElement>(
  properties: string,
  { timeoutMs = 1000 }: { timeoutMs?: number } = {},
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    node.style.willChange = properties;

    const clear = () => {
      node.style.willChange = "auto";
    };

    node.addEventListener("animationend", clear);
    node.addEventListener("transitionend", clear);
    const timeoutId = window.setTimeout(clear, timeoutMs);

    return () => {
      node.removeEventListener("animationend", clear);
      node.removeEventListener("transitionend", clear);
      window.clearTimeout(timeoutId);
      clear();
    };
  }, [properties, timeoutMs]);

  return ref;
}
