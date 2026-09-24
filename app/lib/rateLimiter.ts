export const rateLimiter = <TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<unknown>,
  maxCalls: number,
  windowMs: number
) => {
  const callTimestamps: number[] = [];
  return async (...args: TArgs): Promise<unknown> => {
    const now = Date.now();
    const windowStart = now - windowMs;
    while (callTimestamps.length > 0 && callTimestamps[0] <= windowStart) {
      callTimestamps.shift();
    }
    if (callTimestamps.length >= maxCalls) {
      if (typeof window !== 'undefined') {
        // Calculate when the oldest call in the window will expire
        const resetAt = callTimestamps[0] + windowMs;
        const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
        window.dispatchEvent(
          new CustomEvent("rate-limit-exceeded", {
            detail: {
              message: `Rate limit exceeded. Max ${maxCalls} calls per ${windowMs / 1000}s.`,
              resetAt,
              retryAfter,
              limit: maxCalls,
              remaining: 0,
            },
          })
        );
      }
      throw new Error("RATE_LIMIT_EXCEEDED");
    }
    callTimestamps.push(now);
    return fn(...args);
  };
};
