import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getMiddlewareRedirectTarget } from "@/app/lib/authRedirect";

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

    const redirectTarget = getMiddlewareRedirectTarget(pathname, hasToken, onboardingStep);

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
