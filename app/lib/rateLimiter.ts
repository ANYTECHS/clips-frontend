export const rateLimiter = <TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<unknown>,
  maxCalls: number,
  windowMs: number
) => {
  const callTimestamps: number[] = [];
  return async (...args: TArgs): Promise<unknown> => {
    const now = Date.now();
    const windowStart = now - windowMs;
    while (callTimestamps.length > 0 && callTimestamps[0] < windowStart) {
      callTimestamps.shift();
    }
    if (callTimestamps.length >= maxCalls) {
      if (typeof window !== "undefined") {
        const resetAt = callTimestamps[0] + windowMs;
        window.dispatchEvent(
          new CustomEvent("rate-limit-exceeded", {
            detail: {
              message: `Rate limit exceeded. Max ${maxCalls} calls per ${windowMs / 1000}s.`,
              resetAt,
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
