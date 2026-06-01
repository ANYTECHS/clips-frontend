import type { User } from "./mockApi";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/onboarding",
  "/earnings",
  "/projects",
  "/vault",
  "/platforms",
  "/clips",
];

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

export function isAuthRoute(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}

export type AuthRedirectInput = {
  pathname: string;
  user: User | null;
  isAuthReady: boolean;
};

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
