/**
 * Resource loading prioritization.
 *
 * This module centralizes the app's understanding of which assets and network
 * requests are on the critical rendering path and therefore deserve preload or
 * preconnect treatment before lower-value work. The purpose is to keep the
 * initial route responsive without overloading the network with everything at
 * once.
 */

export type ResourcePriority = "high" | "medium" | "low";

export interface ResourcePriorityHint {
  href: string;
  rel: "preconnect" | "dns-prefetch" | "preload";
  priority: ResourcePriority;
  fetchPriority?: "high" | "auto" | "low";
  as?: "image" | "font" | "script" | "style";
  crossOrigin?: "anonymous" | "use-credentials";
  description?: string;
}

export const RESOURCE_PRIORITY_RANK: Record<ResourcePriority, number> = {
  high: 1,
  medium: 2,
  low: 3,
};

export const CRITICAL_RESOURCE_HINTS: ResourcePriorityHint[] = [
  {
    href: "https://api.dicebear.com",
    rel: "preconnect",
    priority: "high",
    fetchPriority: "high",
    crossOrigin: "anonymous",
    description: "Landing hero avatars are above the fold and load during initial render.",
  },
  {
    href: "/fonts/inter-var.woff2",
    rel: "preload",
    priority: "high",
    as: "font",
    fetchPriority: "high",
    crossOrigin: "anonymous",
    description: "Primary font is part of the critical text rendering path.",
  },
  {
    href: "/favicon.ico",
    rel: "preload",
    priority: "medium",
    as: "image",
    fetchPriority: "auto",
    description: "Small but visible browser chrome asset; lower urgency than the hero font.",
  },
];

export function getCriticalResourceHints(): ResourcePriorityHint[] {
  return [...CRITICAL_RESOURCE_HINTS].sort(
    (left, right) => RESOURCE_PRIORITY_RANK[left.priority] - RESOURCE_PRIORITY_RANK[right.priority],
  );
}

export function getResourcePriorityPlan(): ResourcePriorityHint[] {
  return getCriticalResourceHints().map((hint) => ({
    ...hint,
    rel: hint.rel,
  }));
}

export function getResourcePriority(label: string): ResourcePriority {
  const matches = CRITICAL_RESOURCE_HINTS.find((hint) =>
    hint.href.includes(label) || hint.description?.includes(label),
  );

  return matches?.priority ?? "low";
}
