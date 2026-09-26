"use client";

import React, { useEffect, useState } from "react";
import { useIntersectionObserver } from "@/app/hooks/useIntersectionObserver";
import { scheduleRender, type RenderPriority } from "@/app/lib/renderPriorityQueue";

export interface LazyRenderProps {
  children: React.ReactNode;
  /** Placeholder shown until the content has rendered. Defaults to a same-sized empty box. */
  fallback?: React.ReactNode;
  /** Distance from the viewport at which to start rendering. Default "200px". */
  rootMargin?: string;
  /** Once visible, how urgently to hand the render to the priority queue. Default "low". */
  priority?: RenderPriority;
  /** Minimum height reserved for the placeholder, to avoid layout shift. */
  minHeight?: number | string;
  className?: string;
}

/**
 * Defers rendering below-fold content until it is about to enter the
 * viewport, so off-screen sections don't cost render/layout time up front.
 * Once visible, the actual render is handed to the priority queue rather
 * than happening synchronously with the intersection event.
 */
export default function LazyRender({
  children,
  fallback,
  rootMargin = "200px",
  priority = "low",
  minHeight,
  className,
}: LazyRenderProps) {
  const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({ rootMargin, once: true });
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (!isIntersecting || shouldRender) return;
    const cancel = scheduleRender(() => setShouldRender(true), priority);
    return cancel;
  }, [isIntersecting, shouldRender, priority]);

  return (
    <div ref={ref} className={className} style={minHeight ? { minHeight } : undefined}>
      {shouldRender ? children : (fallback ?? null)}
    </div>
  );
}
