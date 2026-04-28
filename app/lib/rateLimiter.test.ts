import { rateLimiter } from './rateLimiter';

describe('rateLimiter', () => {
  jest.useFakeTimers();

  it('allows calls within limit', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const limited = rateLimiter(fn, 2, 1000);
    await limited();
    await limited();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws on exceeding limit', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const limited = rateLimiter(fn, 1, 1000);
    await limited();
    await expect(limited()).rejects.toThrow('RATE_LIMIT_EXCEEDED');
  });

  it('resets after window passes', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const limited = rateLimiter(fn, 1, 1000);
    await limited();
    jest.advanceTimersByTime(1001);
    await limited();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
