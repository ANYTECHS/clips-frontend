import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiKeyService, type VerifiedApiKey } from '../api-key.service';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';

type RequestWithApiKey = Request & {
  apiKey?: VerifiedApiKey;
  user?: { id: number; viaApiKey?: boolean };
};

/**
 * ApiKeyAuthGuard — Issue #1402
 *
 * Global guard (registered via APP_GUARD) that runs before route guards.
 * When a request carries an API key (`X-API-Key` header or
 * `Authorization: Bearer ck_...`), it verifies the key and attaches
 * `req.apiKey` + `req.user` so downstream guards (JwtAuthGuard, ScopesGuard)
 * treat the caller as authenticated.
 *
 * Requests without an API-key credential pass through untouched — JWT auth
 * continues to work exactly as before. An invalid/revoked/expired key
 * presented as a credential is rejected with 401.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithApiKey>();

    // API keys must never manage API keys — leave /api-keys to JWT auth.
    if (request.path?.startsWith('/api-keys')) return true;

    const rawKey = ApiKeyService.extractKey(request.headers ?? {});
    if (!rawKey) return true; // no API-key credential → JWT path handles it

    const verified = await this.apiKeyService.verify(rawKey);
    if (!verified) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    request.apiKey = verified;
    request.user = { id: verified.userId, viaApiKey: true };
    return true;
  }
}
