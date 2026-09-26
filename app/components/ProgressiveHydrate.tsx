"use client";

/**
 * ProgressiveHydrate
 *
 * Wraps a non-critical client island so its hydration (bundle download +
 * mount + event listener attachment) is deferred until the chosen strategy
 * is satisfied, keeping the rest of the page interactive sooner. Renders
 * `fallback` (a static skeleton — no listeners attached) until then, then
 * swaps in `children`.
 *
 * Combine with a section-scoped HydrationErrorBoundary so a broken island
 * degrades gracefully instead of taking down the whole page.
 *
 * @example
 * <ProgressiveHydrate strategy="visible" fallback={<Skeleton />}>
 *   <WalletHealthCard publicKey={publicKey} />
 * </ProgressiveHydrate>
 */

import type { ReactNode } from "react";
import {
  useProgressiveHydration,
  type HydrationStrategy,
} from "@/app/lib/hydration/useProgressiveHydration";

interface ProgressiveHydrateProps {
  children: ReactNode;
  fallback: ReactNode;
  strategy?: HydrationStrategy;
  className?: string;
}

export default function ProgressiveHydrate({
  children,
  fallback,
  strategy = "visible",
  className,
}: ProgressiveHydrateProps) {
  const { ref, isReady } = useProgressiveHydration<HTMLDivElement>(strategy);

  return (
    <div ref={ref} className={className}>
      {isReady ? children : fallback}
    </div>
  );
}
