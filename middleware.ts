/**
 * middleware.ts — Edge-based route protection
 *
 * This middleware runs on the edge (before the page renders) using NextAuth JWT.
 * It prevents dashboard content leaks by redirecting unauthenticated users
 * server-side before any page rendering occurs.
 *
 * Protected routes are defined in app/lib/authRedirect.ts.
 * Auth routes (/login, /signup, /) redirect authenticated users to dashboard.
 *
 * The AuthProvider client component now uses this as a fallback only,
 * providing additional safety layer for client-side navigation.
 *
 * Environment variable:
 *   NEXTAUTH_SECRET — Required for JWT validation (set automatically by NextAuth)
 */

import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  "/dashboard",
  "/onboarding",
  "/earnings",
  "/projects",
  "/vault",
  "/platforms",
  "/clips",
];

// Auth routes that redirect authenticated users away
const AUTH_ROUTES = ["/login", "/signup"];

/**
 * Check if a pathname is a protected route.
 * Protected routes require authentication.
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Check if a pathname is an auth route.
 * Auth routes redirect authenticated users to dashboard.
 */
function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route);
}

/**
 * Determine the redirect target based on auth status and current route.
 * Returns null if no redirect is needed.
 */
function getRedirectTarget(
  pathname: string,
  hasToken: boolean,
  onboardingStep?: number,
): string | null {
  // Unauthenticated user accessing protected route → redirect to login
  if (!hasToken && isProtectedRoute(pathname)) {
    return "/login";
  }

  // Authenticated user accessing auth routes or root → redirect to dashboard
  if (hasToken && (isAuthRoute(pathname) || pathname === "/")) {
    // Check onboarding step
    const step = onboardingStep || 3;
    if (step === 1 || step === 2) {
      return "/onboarding";
    }
    return "/dashboard";
  }

  // Authenticated user on onboarding but already completed → redirect to dashboard
  if (hasToken && pathname === "/onboarding" && (onboardingStep || 3) > 2) {
    return "/dashboard";
  }

  return null;
}

export default withAuth(function middleware(request: NextRequest) {
  const token = request.nextauth.token;
  const pathname = request.nextUrl.pathname;

  // Extract onboarding step from token if available
  const onboardingStep = token ? (token as any).onboardingStep : undefined;
  const hasToken = !!token;

  // Determine if a redirect is needed
  const redirectTarget = getRedirectTarget(pathname, hasToken, onboardingStep);

  if (redirectTarget) {
    return NextResponse.redirect(new URL(redirectTarget, request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Protected routes - require authentication
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/earnings/:path*",
    "/projects/:path*",
    "/vault/:path*",
    "/platforms/:path*",
    "/clips/:path*",
    // Auth routes - redirect authenticated users
    "/login",
    "/signup",
    // Root path - redirect authenticated users to dashboard
    "/",
    // Explicitly exclude Next.js internals and static assets
    "/((?!_next|api|static|favicon.ico).*)",
  ],
};
