import { ForbiddenException } from '@nestjs/common';
import { ScopesGuard } from './scopes.guard';
import { Reflector } from '@nestjs/core';

const ctx = (request: any) =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  }) as any;

describe('ScopesGuard (Issue #1402)', () => {
  const makeGuard = (requiredScope?: string) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredScope),
    } as unknown as Reflector;
    return new ScopesGuard(reflector);
  };

  it('allows API-key requests with the required scope', () => {
    const guard = makeGuard('clips:read');
    const req = { apiKey: { scopes: ['clips:read', 'clips:write'] } };
    expect(guard.canActivate(ctx(req))).toBe(true);
  });

  it('rejects API-key requests missing the scope, naming it', () => {
    const guard = makeGuard('clips:mint');
    const req = { apiKey: { scopes: ['clips:read'] } };
    expect(() => guard.canActivate(ctx(req))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx(req))).toThrow(
      'API key missing required scope: clips:mint',
    );
  });

  it('does not restrict JWT-authenticated requests', () => {
    const guard = makeGuard('clips:mint');
    const req = { user: { id: 1 } }; // no apiKey → session user
    expect(guard.canActivate(ctx(req))).toBe(true);
  });

  it('passes when the route declares no required scope', () => {
    const guard = makeGuard(undefined);
    const req = { apiKey: { scopes: [] } };
    expect(guard.canActivate(ctx(req))).toBe(true);
  });
});
