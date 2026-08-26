import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PROTECTED_ROUTES } from "@/app/lib/authRedirect";

const AUTH_ROUTES = ["/login", "/signup"];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route);
}

function getRedirectTarget(
  pathname: string,
  hasToken: boolean,
  onboardingStep?: number
): string | null {
  if (!hasToken && isProtectedRoute(pathname)) {
    return "/login";
  }

  if (hasToken && (isAuthRoute(pathname) || pathname === "/")) {
    const step = onboardingStep || 3;
    if (step === 1 || step === 2) {
      return "/onboarding";
    }
    return "/dashboard";
  }

  if (hasToken && pathname === "/onboarding" && (onboardingStep || 3) > 2) {
    return "/dashboard";
  }

  return null;
}

let authMiddleware: ((request: NextRequest) => ReturnType<typeof NextResponse.next>) | null =
  null;

async function getAuthMiddleware() {
  if (authMiddleware) return authMiddleware;

  const { auth } = await import("@/app/lib/auth");
  authMiddleware = auth((request) => {
    const session = request.auth;
    const pathname = request.nextUrl.pathname;
    const onboardingStep = session?.user
      ? (session.user as { onboardingStep?: number }).onboardingStep
      : undefined;
    const hasToken = !!session;

    const redirectTarget = getRedirectTarget(pathname, hasToken, onboardingStep);

    if (redirectTarget) {
      return NextResponse.redirect(new URL(redirectTarget, request.url));
    }

    return NextResponse.next();
  });

  return authMiddleware;
}

export default async function middleware(request: NextRequest) {
  if (process.env.E2E_SKIP_MIDDLEWARE === "true") {
    return NextResponse.next();
  }

  const handler = await getAuthMiddleware();
  return handler(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/earnings/:path*",
    "/projects/:path*",
    "/vault/:path*",
    "/platforms/:path*",
    "/clips/:path*",
    "/login",
    "/signup",
    "/",
    "/((?!_next|api|static|favicon.ico).*)",
  ],
};
