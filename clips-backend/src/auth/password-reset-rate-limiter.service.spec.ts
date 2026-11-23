import { HttpException, HttpStatus } from '@nestjs/common';
import {
  PasswordResetRateLimiterService,
  PASSWORD_RESET_LIMIT,
  PASSWORD_RESET_WINDOW_SECONDS,
} from './password-reset-rate-limiter.service';
import { AuthController } from './auth.controller';

/** Minimal in-memory stand-in for RedisService's safe wrappers. */
function makeRedis(available = true) {
  const store = new Map<string, { value: number; expiresAt?: number }>();
  const live = (key: string) => {
    const entry = store.get(key);
    if (entry?.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return undefined;
    }
    return entry;
  };
  return {
    isAvailable: jest.fn(() => available),
    incr: jest.fn(async (key: string) => {
      const entry = live(key) ?? { value: 0 };
      entry.value += 1;
      store.set(key, entry);
      return entry.value;
    }),
    expire: jest.fn(async (key: string, seconds: number) => {
      const entry = live(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + seconds * 1000;
      return 1;
    }),
    ttl: jest.fn(async (key: string) => {
      const entry = live(key);
      if (!entry) return -2;
      if (entry.expiresAt === undefined) return -1;
      return Math.ceil((entry.expiresAt - Date.now()) / 1000);
    }),
  };
}

describe('PasswordResetRateLimiterService', () => {
  afterEach(() => jest.useRealTimers());

  it.each([
    ['Redis', true],
    ['in-memory fallback', false],
  ])('limits to 3 requests per hour per email (%s)', async (_label, available) => {
    const limiter = new PasswordResetRateLimiterService(makeRedis(available) as any);

    for (let i = 0; i < PASSWORD_RESET_LIMIT; i++) {
      const result = await limiter.consume('victim@example.com', `10.0.0.${i}`);
      expect(result.allowed).toBe(true);
    }

    // 4th request for the same email from yet another IP is rejected.
    const blocked = await limiter.consume('Victim@Example.com ', '10.0.0.99');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(PASSWORD_RESET_WINDOW_SECONDS);
  });

  it.each([
    ['Redis', true],
    ['in-memory fallback', false],
  ])('limits to 3 requests per hour per IP (%s)', async (_label, available) => {
    const limiter = new PasswordResetRateLimiterService(makeRedis(available) as any);

    for (let i = 0; i < PASSWORD_RESET_LIMIT; i++) {
      const result = await limiter.consume(`user${i}@example.com`, '203.0.113.7');
      expect(result.allowed).toBe(true);
    }

    const blocked = await limiter.consume('someone-else@example.com', '203.0.113.7');
    expect(blocked.allowed).toBe(false);
  });

  it('allows requests again once the hour has passed', async () => {
    jest.useFakeTimers();
    const limiter = new PasswordResetRateLimiterService(makeRedis(false) as any);

    for (let i = 0; i <= PASSWORD_RESET_LIMIT; i++) {
      await limiter.consume('user@example.com', '198.51.100.1');
    }
    expect((await limiter.consume('user@example.com', '198.51.100.1')).allowed).toBe(false);

    jest.advanceTimersByTime(PASSWORD_RESET_WINDOW_SECONDS * 1000 + 1);

    expect((await limiter.consume('user@example.com', '198.51.100.1')).allowed).toBe(true);
  });
});

describe('AuthController.forgotPassword rate limit', () => {
  function makeController() {
    const authService = { forgotPassword: jest.fn().mockResolvedValue(undefined) };
    const limiter = new PasswordResetRateLimiterService(makeRedis() as any);
    const controller = new AuthController(
      authService as any,
      {} as any,
      {} as any,
      {} as any,
      limiter,
    );
    const res = { setHeader: jest.fn() };
    return { controller, authService, res };
  }

  it('returns the same response for existing and unknown emails', async () => {
    const { controller, res } = makeController();
    const req = { ip: '192.0.2.1' };

    const known = await controller.forgotPassword(
      { email: 'known@example.com' } as any,
      req,
      res as any,
    );
    const unknown = await controller.forgotPassword(
      { email: 'unknown@example.com' } as any,
      req,
      res as any,
    );

    expect(unknown).toEqual(known);
  });

  it('returns 429 on the 4th request within an hour and stops sending emails', async () => {
    const { controller, authService, res } = makeController();
    const req = { ip: '192.0.2.2' };
    const dto = { email: 'target@example.com' } as any;

    for (let i = 0; i < PASSWORD_RESET_LIMIT; i++) {
      await controller.forgotPassword(dto, req, res as any);
    }

    await expect(controller.forgotPassword(dto, req, res as any)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    await expect(controller.forgotPassword(dto, req, res as any)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(authService.forgotPassword).toHaveBeenCalledTimes(PASSWORD_RESET_LIMIT);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });
});
