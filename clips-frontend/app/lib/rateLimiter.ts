export const rateLimiter = (fn: Function, maxCalls: number, windowMs: number) => {
  const callTimestamps: number[] = [];
  return async (...args: any[]) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    while (callTimestamps.length > 0 && callTimestamps[0] < windowStart) {
      callTimestamps.shift();
    }
    if (callTimestamps.length >= maxCalls) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('rate-limit-exceeded', {
            detail: {
              message: `Rate limit exceeded. Max ${maxCalls} calls per ${windowMs / 1000}s.`,
            },
          })
        );
      }
      throw new Error('RATE_LIMIT_EXCEEDED');
    }
    callTimestamps.push(now);
    return fn(...args);
  };
};
