"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export interface UseIntersectionObserverOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
  /** Stop observing after the first intersection. Default true. */
  once?: boolean;
  /** Skip observing entirely, e.g. when the feature is disabled. */
  enabled?: boolean;
}

export interface UseIntersectionObserverResult<T extends Element> {
  ref: RefObject<T | null>;
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
}

/**
 * Reusable Intersection Observer hook for viewport-based rendering and data
 * fetching. Attach `ref` to the element to watch; `isIntersecting` flips to
 * true once it enters the viewport (or `rootMargin`).
 *
 * ```tsx
 * const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({ rootMargin: "200px" });
 * return <div ref={ref}>{isIntersecting ? <Content /> : <Skeleton />}</div>;
 * ```
 */
export function useIntersectionObserver<T extends Element = Element>(
  options: UseIntersectionObserverOptions = {},
): UseIntersectionObserverResult<T> {
  const { root = null, rootMargin = "200px", threshold = 0, once = true, enabled = true } = options;

  const ref = useRef<T | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return;

    if (typeof IntersectionObserver === "undefined") {
      // No IO support (very old browser / non-DOM test env): render eagerly
      // rather than never at all.
      setIsIntersecting(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([observedEntry]) => {
        setEntry(observedEntry);
        if (observedEntry.isIntersecting) {
          setIsIntersecting(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setIsIntersecting(false);
        }
      },
      { root, rootMargin, threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, rootMargin, once, enabled, Array.isArray(threshold) ? threshold.join(",") : threshold]);

  return { ref, isIntersecting, entry };
}
