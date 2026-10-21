/**
 * middleware.ts
 *
 * Runs on every matched request before the page/route handler.
 *
 * Responsibilities:
 *   1. Auth-based route protection and redirects (existing behaviour).
 *   2. Security headers applied to every response — including redirects and
 *      early exits — so headers are guaranteed regardless of which Next.js
 *      layer ultimately generates the response.
 *
 * Header strategy
 * ───────────────
 *   next.config.ts already sets these headers via the `headers()` async
 *   function, which covers rendered pages and static assets served by the
 *   Node runtime.  However that layer does not cover:
 *     • Redirect responses emitted by middleware itself (302/307).
 *     • Responses short-circuited before reaching the render pipeline.
 *     • Some edge/CDN deployments where Next.js config headers are not
 *       forwarded by the host.
 *
 *   Setting headers in middleware is the only way to guarantee they appear
 *   on *every* HTTP response the origin emits.  Duplicate headers on normal
 *   page responses are harmless — the last value wins in most HTTP stacks,
 *   and both layers emit identical values.
 *
 * Exclusions
 * ──────────
 *   /api/health — intentionally header-free so monitoring agents and load-
 *   balancer health-checks receive a minimal, predictable response.
 *
 * HSTS
 * ────
 *   Strict-Transport-Security must only be sent over HTTPS.  Sending it on
 *   plaintext HTTP (localhost dev) would cause browsers to HSTS-pin a host
 *   that has no TLS certificate, breaking subsequent dev sessions.
 *   We detect HTTPS via the `x-forwarded-proto` header (set by Vercel,
 *   Cloudflare, and most reverse proxies) or by checking NODE_ENV and the
 *   request URL scheme directly.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getMiddlewareRedirectTarget } from "@/app/lib/authRedirect";

// ─── Security header definitions ─────────────────────────────────────────────

/**
 * Headers applied to every response (except /api/health).
 * Values are intentionally conservative — no wildcards, no unsafe-inline here.
 */
const ALWAYS_HEADERS: ReadonlyArray<[string, string]> = [
  // Prevent MIME-type sniffing attacks.
  ["X-Content-Type-Options", "nosniff"],

  // Disallow embedding in frames/iframes (also enforced via CSP frame-ancestors
  // in next.config.ts, but belt-and-suspenders is correct here).
  ["X-Frame-Options", "DENY"],

  // Controls how much referrer information is included in cross-origin requests.
  ["Referrer-Policy", "strict-origin-when-cross-origin"],

  // Disable browser access to sensitive hardware APIs.
  // payment is included per the acceptance criteria.
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"],

  // Prevent the browser from opening a new top-level context from a
  // cross-origin navigation (clickjacking / Spectre mitigation).
  ["Cross-Origin-Opener-Policy", "same-origin"],

  // Disallow cross-origin loading of this origin's resources.
  ["Cross-Origin-Resource-Policy", "same-origin"],

  // Stop the browser from performing DNS prefetch on href/src attributes —
  // reduces info leakage to third-party DNS resolvers.
  ["X-DNS-Prefetch-Control", "off"],
];

/**
 * HSTS value: 2-year max-age, include subdomains, eligible for browser preload.
 * Only sent when the connection is confirmed to be HTTPS.
 */
const HSTS_VALUE = "max-age=63072000; includeSubDomains; preload";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when the request arrived over HTTPS.
 *
 * Detection order:
 *   1. `x-forwarded-proto` header (Vercel, Cloudflare, Nginx proxy).
 *   2. NODE_ENV === "production" (production deployments are always TLS).
 *   3. The request URL scheme itself (edge runtime direct HTTPS requests).
 *
 * Localhost and plain-HTTP dev environments will correctly return false.
 */
function isHttps(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0].trim() === "https";
  }
  if (process.env.NODE_ENV === "production") {
    return true;
  }
  return request.url.startsWith("https://");
}

/**
 * Applies the security header set to a NextResponse.
 * Mutates the response in place — safe because we always own the response
 * object at this point.
 */
function applySecurityHeaders(response: NextResponse, request: NextRequest): void {
  for (const [name, value] of ALWAYS_HEADERS) {
    response.headers.set(name, value);
  }

  if (isHttps(request)) {
    response.headers.set("Strict-Transport-Security", HSTS_VALUE);
  }
}

// ─── Auth middleware (lazy-loaded to avoid bundling auth on cold starts) ──────

let authMiddleware:
  | ((request: NextRequest) => ReturnType<typeof NextResponse.next>)
  | null = null;

async function getAuthMiddleware() {
  if (authMiddleware) return authMiddleware;

  const { auth } = await import("@/app/lib/auth");
  authMiddleware = auth((request) => {
    const session = request.auth;
    const pathname = request.nextUrl.pathname;
    const onboardingStep = session?.user
      ? (session.user as { onboardingStep?: number }).onboardingStep
      : undefined;
    const hasToken = !!session?.user?.id;

    const redirectTarget = getMiddlewareRedirectTarget(
      pathname,
      hasToken,
      onboardingStep,
    );

    if (redirectTarget) {
      return NextResponse.redirect(new URL(redirectTarget, request.url));
    }

    return NextResponse.next();
  });

  return authMiddleware;
}

// ─── Main middleware export ───────────────────────────────────────────────────

export default async function middleware(request: NextRequest): Promise<NextResponse> {
  // E2E tests bypass all middleware (auth + headers) when this flag is set.
  if (process.env.E2E_SKIP_MIDDLEWARE === "true") {
    return NextResponse.next();
  }

  // /api/health — return immediately with no security headers so monitoring
  // agents and load-balancer probes receive a minimal, predictable response.
  if (request.nextUrl.pathname === "/api/health") {
    return NextResponse.next();
  }

  // Run auth protection / redirect logic.
  const handler = await getAuthMiddleware();
  const response = (await handler(request)) as NextResponse;

  // Stamp security headers onto whatever response the auth handler produced
  // (could be a redirect, a rewrite, or a passthrough NextResponse.next()).
  applySecurityHeaders(response, request);

  return response;
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
    // Catch-all: everything except Next.js internals, static files and the
    // health endpoint.  The health exclusion is also handled at runtime above
    // so it works even if the matcher pattern is broadened in future.
    "/((?!_next|static|favicon.ico|api/health).*)",
  ],
};
