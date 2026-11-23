import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { Reflector } from '@nestjs/core';

const ctx = (request: any) =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  }) as any;

describe('ApiKeyAuthGuard (Issue #1402)', () => {
  const apiKeyService = { verify: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  let guard: ApiKeyAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new ApiKeyAuthGuard(apiKeyService as any, reflector as any);
  });

  it('passes through when no API-key credential is present', async () => {
    const req = { headers: {}, path: '/clips' };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(apiKeyService.verify).not.toHaveBeenCalled();
  });

  it('authenticates a valid X-API-Key and attaches req.apiKey + req.user', async () => {
    apiKeyService.verify.mockResolvedValue({
      id: 'key-1',
      userId: 42,
      scopes: ['clips:read'],
    });
    const req = { headers: { 'x-api-key': 'ck_abc' }, path: '/clips' };

    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.apiKey).toEqual({
      id: 'key-1',
      userId: 42,
      scopes: ['clips:read'],
    });
    expect(req.user).toEqual({ id: 42, viaApiKey: true });
  });

  it('accepts Bearer ck_... tokens', async () => {
    apiKeyService.verify.mockResolvedValue({ id: 'k', userId: 1, scopes: [] });
    const req = {
      headers: { authorization: 'Bearer ck_abc123' },
      path: '/clips',
    };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(apiKeyService.verify).toHaveBeenCalledWith('ck_abc123');
  });

  it('rejects an invalid key with 401', async () => {
    apiKeyService.verify.mockResolvedValue(null);
    const req = { headers: { 'x-api-key': 'ck_bad' }, path: '/clips' };
    await expect(guard.canActivate(ctx(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('never authenticates API keys on /api-keys routes', async () => {
    const req = { headers: { 'x-api-key': 'ck_abc' }, path: '/api-keys' };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(apiKeyService.verify).not.toHaveBeenCalled();
  });
});
