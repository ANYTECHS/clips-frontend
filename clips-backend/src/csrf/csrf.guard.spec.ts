import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from './csrf.service';

function makeContext(opts: {
  method: string;
  path: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  body?: Record<string, unknown>;
}) {
  const request = {
    method: opts.method,
    path: opts.path,
    headers: opts.headers ?? {},
    cookies: opts.cookies ?? {},
    body: opts.body ?? {},
  };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
  } as any;
}

describe('CsrfGuard', () => {
  const csrfService = new CsrfService({ get: () => 'test' } as any);
  const guard = new CsrfGuard(csrfService);
  const token = csrfService.generateToken();

  it.each(['POST', 'PATCH', 'DELETE', 'PUT'])(
    'rejects %s with 403 when the CSRF token is missing',
    (method) => {
      const ctx = makeContext({
        method,
        path: '/users/me',
        cookies: { _csrf: token },
      });

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
      try {
        guard.canActivate(ctx);
      } catch (err) {
        expect((err as ForbiddenException).getStatus()).toBe(
          HttpStatus.FORBIDDEN,
        );
      }
    },
  );

  it('rejects API key creation without a token (not covered by the /api exemption)', () => {
    const ctx = makeContext({
      method: 'POST',
      path: '/api-keys',
      cookies: { _csrf: token },
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects a token that does not match the cookie', () => {
    const ctx = makeContext({
      method: 'POST',
      path: '/api-keys',
      headers: { 'x-csrf-token': csrfService.generateToken() },
      cookies: { _csrf: token },
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects when the cookie is missing', () => {
    const ctx = makeContext({
      method: 'DELETE',
      path: '/api-keys/1',
      headers: { 'x-csrf-token': token },
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows a matching header token', () => {
    const ctx = makeContext({
      method: 'POST',
      path: '/api-keys',
      headers: { 'x-csrf-token': token },
      cookies: { _csrf: token },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows a matching _csrf body field', () => {
    const ctx = makeContext({
      method: 'PATCH',
      path: '/users/me',
      body: { _csrf: token },
      cookies: { _csrf: token },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('skips safe methods', () => {
    expect(guard.canActivate(makeContext({ method: 'GET', path: '/api-keys' }))).toBe(true);
  });

  it('skips pre-session auth routes', () => {
    expect(
      guard.canActivate(makeContext({ method: 'POST', path: '/auth/login' })),
    ).toBe(true);
  });

  it('skips API key and Bearer authenticated requests', () => {
    expect(
      guard.canActivate(
        makeContext({ method: 'POST', path: '/clips', headers: { 'x-api-key': 'k' } }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        makeContext({
          method: 'POST',
          path: '/clips',
          headers: { authorization: 'Bearer abc.def.ghi' },
        }),
      ),
    ).toBe(true);
  });
});
