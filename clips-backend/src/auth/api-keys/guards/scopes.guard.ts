import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRED_SCOPE_KEY } from '../decorators/require-scope.decorator';
import type { ApiScope } from '../api-key.constants';
import type { VerifiedApiKey } from '../api-key.service';

type RequestWithApiKey = Request & { apiKey?: VerifiedApiKey };

/**
 * ScopesGuard — Issue #1402
 *
 * Global guard that enforces `@RequireScope('<scope>')` route metadata for
 * requests authenticated with an API key. JWT (session) requests are not
 * scope-limited and always pass.
 *
 * Out-of-scope API-key requests are rejected with 403 naming the missing
 * scope, e.g. `API key missing required scope: clips:mint`.
 */
@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScope = this.reflector.getAllAndOverride<ApiScope | undefined>(
      REQUIRED_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredScope) return true;

    const request = context.switchToHttp().getRequest<RequestWithApiKey>();
    const apiKey = request.apiKey;
    if (!apiKey) return true; // JWT-authenticated or public request

    const scopes = apiKey.scopes ?? [];
    if (!scopes.includes(requiredScope)) {
      throw new ForbiddenException(
        `API key missing required scope: ${requiredScope}`,
      );
    }
    return true;
  }
}
