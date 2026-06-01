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

// Property-based tests for sliding window correctness (#439)
describe('rateLimiter – property-based sliding window', () => {
  jest.useFakeTimers();

  // Property: exactly maxCalls calls succeed, the (maxCalls+1)-th always throws
  it.each([
    [1, 500],
    [2, 1000],
    [5, 2000],
    [3, 750],
  ])('allows exactly %i calls then rejects within window of %ims', async (maxCalls, windowMs) => {
    const fn = jest.fn().mockResolvedValue('ok');
    const limited = rateLimiter(fn, maxCalls, windowMs);

    for (let i = 0; i < maxCalls; i++) {
      await limited();
    }
    expect(fn).toHaveBeenCalledTimes(maxCalls);
    await expect(limited()).rejects.toThrow('RATE_LIMIT_EXCEEDED');
  });

  // Property: after the window expires the counter resets and exactly maxCalls succeed again
  it.each([
    [1, 500],
    [3, 1000],
    [2, 300],
  ])('resets correctly after window for maxCalls=%i windowMs=%i', async (maxCalls, windowMs) => {
    const fn = jest.fn().mockResolvedValue('ok');
    const limited = rateLimiter(fn, maxCalls, windowMs);

    for (let i = 0; i < maxCalls; i++) await limited();
    jest.advanceTimersByTime(windowMs + 1);

    // All maxCalls should succeed again
    for (let i = 0; i < maxCalls; i++) await limited();
    expect(fn).toHaveBeenCalledTimes(maxCalls * 2);
  });

  // Property: calls made just before window expiry still count; calls after do not
  it('old timestamps outside the window are evicted before checking the limit', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const limited = rateLimiter(fn, 2, 1000);

    await limited(); // t=0
    jest.advanceTimersByTime(600);
    await limited(); // t=600 — both timestamps in window, limit reached
    await expect(limited()).rejects.toThrow('RATE_LIMIT_EXCEEDED');

    jest.advanceTimersByTime(401); // t=1001 — first call (t=0) is now outside window
    await limited(); // should succeed: only t=600 remains in window
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
