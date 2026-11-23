/**
 * Canonical API-key scope names (Issue #1402).
 *
 * Routes declare their requirement with `@RequireScope('<scope>')`.
 * `ScopesGuard` rejects API-key requests whose key lacks the scope with
 * 403 and the missing scope named in the response.
 */
export const API_SCOPES = [
  'videos:read',
  'videos:write',
  'clips:read',
  'clips:write',
  'clips:delete',
  'clips:mint',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

/** Raw keys are prefixed so they can be identified in logs/headers. */
export const API_KEY_PREFIX = 'ck_';

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}
