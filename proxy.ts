import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const protectedPaths = ['/dashboard', '/projects', '/clips', '/platforms', '/onboarding'];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  const hasCookies = request.cookies.getAll().length > 0;

  if (isProtectedPath && !hasCookies) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
