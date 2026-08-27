/**
 * Data Prefetch Strategies
 * 
 * Identifies and manages prefetching opportunities to reduce navigation latency.
 * Implements route-based, hover-based, and intelligent prefetch cancellation.
 * 
 * Strategy:
 * 1. Route-based: Prefetch data for routes in the navigation menu
 * 2. Hover-based: Prefetch on mouse over for interactive elements
 * 3. Idle-time: Prefetch lower-priority data during browser idle time
 * 4. Cancellation: Cancel in-flight requests if user navigates away
 * 
 * See: https://web.dev/articles/link-prefetch
 */

export interface PrefetchOpportunity {
  route: string;
  dataEndpoints: string[];
  priority: "high" | "medium" | "low";
  triggerType: "route-based" | "hover-based" | "idle-time";
  ttl?: number; // Time to live in ms
}

/**
 * Core navigation routes that are high-priority for prefetching
 */
export const CORE_PREFETCH_ROUTES: PrefetchOpportunity[] = [
  {
    route: "/dashboard",
    dataEndpoints: ["/api/projects", "/api/analytics/summary"],
    priority: "high",
    triggerType: "route-based",
    ttl: 60000, // 1 minute
  },
  {
    route: "/projects",
    dataEndpoints: ["/api/projects", "/api/projects/recent"],
    priority: "high",
    triggerType: "route-based",
    ttl: 60000,
  },
  {
    route: "/analytics",
    dataEndpoints: ["/api/analytics/summary", "/api/analytics/trends"],
    priority: "medium",
    triggerType: "route-based",
    ttl: 300000, // 5 minutes
  },
  {
    route: "/clips",
    dataEndpoints: ["/api/clips/list", "/api/clips/filters"],
    priority: "medium",
    triggerType: "route-based",
    ttl: 60000,
  },
  {
    route: "/settings",
    dataEndpoints: ["/api/user/profile", "/api/user/settings"],
    priority: "low",
    triggerType: "route-based",
    ttl: 300000,
  },
];

/**
 * Interactive elements that benefit from hover-based prefetching
 */
export const HOVER_PREFETCH_ELEMENTS: PrefetchOpportunity[] = [
  {
    route: "/api/clips/:id",
    dataEndpoints: ["/api/clips/{id}/details", "/api/clips/{id}/comments"],
    priority: "high",
    triggerType: "hover-based",
    ttl: 30000, // 30 seconds
  },
  {
    route: "/api/projects/:id",
    dataEndpoints: ["/api/projects/{id}/clips", "/api/projects/{id}/analytics"],
    priority: "high",
    triggerType: "hover-based",
    ttl: 30000,
  },
  {
    route: "/api/user/:id",
    dataEndpoints: ["/api/user/{id}/profile", "/api/user/{id}/clips"],
    priority: "medium",
    triggerType: "hover-based",
    ttl: 60000,
  },
];

/**
 * Idle-time prefetch: Low-priority data fetched when browser is idle
 */
export const IDLE_PREFETCH_STRATEGIES: PrefetchOpportunity[] = [
  {
    route: "/dashboard",
    dataEndpoints: [
      "/api/analytics/detailed",
      "/api/suggestions",
      "/api/news",
    ],
    priority: "low",
    triggerType: "idle-time",
    ttl: 600000, // 10 minutes
  },
  {
    route: "/settings",
    dataEndpoints: ["/api/user/subscription", "/api/user/billing"],
    priority: "low",
    triggerType: "idle-time",
    ttl: 600000,
  },
];

/**
 * Find prefetch opportunities for a given route
 */
export function getPrefetchOpportunities(
  currentRoute: string
): PrefetchOpportunity[] {
  const allStrategies = [
    ...CORE_PREFETCH_ROUTES,
    ...HOVER_PREFETCH_ELEMENTS,
    ...IDLE_PREFETCH_STRATEGIES,
  ];

  return allStrategies.filter(
    (strategy) =>
      strategy.route.includes(currentRoute) || currentRoute.includes(strategy.route)
  );
}

/**
 * Get high-priority prefetch endpoints for immediate loading
 */
export function getImmediatePrefetchEndpoints(
  route: string
): string[] {
  const opportunities = getPrefetchOpportunities(route).filter(
    (opp) =>
      (opp.priority === "high" || opp.priority === "medium") &&
      opp.triggerType === "route-based"
  );

  return opportunities.flatMap((opp) => opp.dataEndpoints);
}

/**
 * Get hover-based prefetch opportunities
 */
export function getHoverPrefetchEndpoints(selector: string): string[] {
  const opportunities = HOVER_PREFETCH_ELEMENTS.filter(
    (opp) =>
      selector.includes(opp.route) || opp.route.includes(selector)
  );

  return opportunities.flatMap((opp) => opp.dataEndpoints);
}

/**
 * Get idle-time prefetch opportunities
 */
export function getIdlePrefetchEndpoints(route: string): string[] {
  const opportunities = IDLE_PREFETCH_STRATEGIES.filter(
    (opp) =>
      opp.route.includes(route) || route.includes(opp.route)
  );

  return opportunities.flatMap((opp) => opp.dataEndpoints);
}
