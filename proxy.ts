import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { REQUEST_ID_HEADER, resolveRequestId, withRequestId } from '@/lib/requestId';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Issue #1391 — one request ID per request. Reuse a valid upstream ID
  // (load balancer / retry) or generate a new one, pass it to route handlers
  // via the request headers and echo it in the `x-request-id` response header.
  const requestId = resolveRequestId(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  // API routes are not page-protected; they only need the request ID.
  if (pathname.startsWith('/api/')) {
    return withRequestId(
      NextResponse.next({ request: { headers: requestHeaders } }),
      requestId
    );
  }

  const protectedPaths = ['/dashboard', '/projects', '/clips', '/platforms', '/onboarding'];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  const hasCookies = request.cookies.getAll().length > 0;

  if (isProtectedPath && !hasCookies) {
    return withRequestId(NextResponse.redirect(new URL('/login', request.url)), requestId);
  }

  return withRequestId(
    NextResponse.next({ request: { headers: requestHeaders } }),
    requestId
  );
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
