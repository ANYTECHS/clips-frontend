import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/** HTTP methods that never change state and therefore skip CSRF checks. */
export const CSRF_SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Routes that are reachable without an authenticated session (so there is no
 * CSRF token to send yet) or that are protected by other means.
 *
 * Matching is done on whole path segments: `/api` exempts `/api` and
 * `/api/docs`, but NOT `/api-keys`.
 */
export const CSRF_EXEMPT_PATHS = [
  '/auth/signup',
  '/auth/login',
  '/auth/magic-link',
  '/auth/verify-magic',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
  '/auth/google',
  '/auth/google/callback',
  '/api',
];

export const CSRF_COOKIE_NAME = '_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

@Injectable()
export class CsrfService {
  constructor(private configService: ConfigService) {}

  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  validateToken(token: string, cookieToken: string): boolean {
    if (
      typeof token !== 'string' ||
      typeof cookieToken !== 'string' ||
      !token ||
      !cookieToken
    ) {
      return false;
    }
    const a = Buffer.from(token);
    const b = Buffer.from(cookieToken);
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  /** True when the path matches an exempt route on a segment boundary. */
  isExemptPath(path: string): boolean {
    return CSRF_EXEMPT_PATHS.some(
      (exempt) => path === exempt || path.startsWith(`${exempt}/`),
    );
  }

  setCsrfCookie(res: any, token: string): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Allow JavaScript to read for header inclusion
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
  }

  clearCsrfCookie(res: any): void {
    res.clearCookie(CSRF_COOKIE_NAME);
  }
}
