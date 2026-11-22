import { SetMetadata } from '@nestjs/common';
import type { ApiScope } from '../api-key.constants';

export const REQUIRED_SCOPE_KEY = 'requiredScope';

/**
 * Declare the API-key scope a route requires (Issue #1402).
 *
 * Enforced by `ScopesGuard` for requests authenticated with an API key.
 * JWT-authenticated (browser session) requests are unaffected — they are
 * not scope-limited.
 *
 * @example
 * @RequireScope('clips:read')
 * @Get() listClips() { ... }
 */
export const RequireScope = (scope: ApiScope) =>
  SetMetadata(REQUIRED_SCOPE_KEY, scope);
