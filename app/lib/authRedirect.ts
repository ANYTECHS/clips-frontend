import type { User } from "./types";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/onboarding",
  "/earnings",
  "/projects",
  "/vault",
  "/platforms",
  "/clips",
];

/**
 * Determines whether a given URL route matches the platform's protected path list.
 *
 * @param pathname - The relative URL string path location being examined.
 * @returns True if the route matches any sequence prefix in the collection.
 */
export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Evaluates whether a route corresponds specifically to authentication registration or login landing steps.
 *
 * @param pathname - The relative URL string path location being examined.
 * @returns True if path matches login or signup exact routes.
 */
export function isAuthRoute(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}

/**
 * Structural context wrapper passed into validation routines to evaluate navigation redirection choices.
 */
export type AuthRedirectInput = {
  /** The destination path layout address requested by the client routing mechanics. */
  pathname: string;
  /** The current user profile entity, or null if the current context session remains unauthenticated. */
  user: User | null;
  /** Explicit guard flag proving that authorization parameters loading steps are finalized. */
  isAuthReady: boolean;
};

/**
 * Executes state rules to derive correct redirect endpoints for structural application route guarding.
 *
 * @param input - The validation metrics model carrying route information and session states.
 * @param input.pathname - Destination route being requested.
 * @param input.user - Active user context payload configuration structure.
 * @param input.isAuthReady - Active load confirmation evaluation state.
 * @returns Next structural route URL target path string to forward the execution context to, or null if no redirect is required.
 */
export function getAuthRedirectTarget({
  pathname,
  user,
  isAuthReady,
}: AuthRedirectInput): string | null {
  if (!isAuthReady) return null;

  const authenticated = !!user;
  const protectedRoute = isProtectedRoute(pathname);
  const authRoute = isAuthRoute(pathname);

  if (!authenticated && protectedRoute) {
    return "/login";
  }

  if (authenticated && (authRoute || pathname === "/")) {
    if (user.onboardingStep === 1 || user.onboardingStep === 2) {
      return "/onboarding";
    }
    return "/dashboard";
  }

  if (authenticated && pathname === "/onboarding" && user.onboardingStep > 2) {
    return "/dashboard";
  }

  return null;
}
