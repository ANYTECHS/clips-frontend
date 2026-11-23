import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  CsrfService,
  CSRF_SAFE_METHODS,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from './csrf.service';

/**
 * Global double-submit-cookie CSRF guard.
 *
 * Every state-changing request (POST/PUT/PATCH/DELETE) must send the token
 * from the `_csrf` cookie back in the `X-CSRF-Token` header (or `_csrf` body
 * field). Missing or mismatched tokens are rejected with 403.
 *
 * Skipped for:
 * - safe methods (GET/HEAD/OPTIONS)
 * - pre-session auth routes listed in CSRF_EXEMPT_PATHS
 * - API-key and Bearer-token requests, which browsers never attach
 *   automatically and are therefore not CSRF-able
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrfService: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (CSRF_SAFE_METHODS.includes(request.method.toUpperCase())) {
      return true;
    }

    const hasApiKey = !!request.headers['x-api-key'];
    const authorization = request.headers['authorization'];
    const hasBearer =
      typeof authorization === 'string' && /^Bearer\s+\S+/i.test(authorization);

    if (this.csrfService.isExemptPath(request.path) || hasApiKey || hasBearer) {
      return true;
    }

    const token =
      (request.headers[CSRF_HEADER_NAME] as string) || request.body?._csrf;
    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];

    if (!this.csrfService.validateToken(token, cookieToken)) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
