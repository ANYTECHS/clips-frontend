import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import type { ApiScope } from './api-key.constants';
import type { VerifiedApiKey } from './api-key.service';

type RequestWithApiKey = Request & { apiKey?: VerifiedApiKey };

/** True when the request was authenticated with an API key. */
export function isApiKeyRequest(req: Request): boolean {
  return Boolean((req as RequestWithApiKey).apiKey);
}

/**
 * Throw 403 naming the missing scope when the request used an API key that
 * lacks `scope`. JWT-authenticated requests always pass.
 */
export function assertApiKeyScope(req: Request, scope: ApiScope): void {
  const apiKey = (req as RequestWithApiKey).apiKey;
  if (!apiKey) return;
  if (!(apiKey.scopes ?? []).includes(scope)) {
    throw new ForbiddenException(`API key missing required scope: ${scope}`);
  }
}
