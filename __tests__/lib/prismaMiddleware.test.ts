import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock logger
jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Prisma Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DATABASE_CONNECTION_TIMEOUT;
    delete process.env.DATABASE_SLOW_QUERY_THRESHOLD;
  });

  describe('createPrismaMiddleware', () => {
    it('should complete query successfully', async () => {
      const { createPrismaMiddleware } = await import('@/app/lib/prismaMiddleware');
      const middleware = createPrismaMiddleware();

      const params = { model: 'User', action: 'findMany' };
      const next = jest.fn().mockResolvedValue([{ id: 1 }]);

      const result = await middleware(params as any, next);

      expect(result).toEqual([{ id: 1 }]);
      expect(next).toHaveBeenCalledWith(params);
    });

    it('should log slow queries', async () => {
      const { logger } = await import('@/app/lib/logger');
      const { createPrismaMiddleware } = await import('@/app/lib/prismaMiddleware');
      
      process.env.DATABASE_SLOW_QUERY_THRESHOLD = '100';
      const middleware = createPrismaMiddleware();

      const params = { model: 'User', action: 'findMany' };
      const next = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 150))
      );

      await middleware(params as any, next);

      expect(logger.warn).toHaveBeenCalledWith(
        '[Prisma] Slow query detected:',
        expect.objectContaining({
          model: 'User',
          action: 'findMany',
        })
      );
    });

    it('should timeout long-running queries', async () => {
      const { createPrismaMiddleware } = await import('@/app/lib/prismaMiddleware');
      
      process.env.DATABASE_CONNECTION_TIMEOUT = '100';
      const middleware = createPrismaMiddleware();

      const params = { model: 'User', action: 'findMany' };
      const next = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(middleware(params as any, next)).rejects.toThrow(
        'Database query timeout after 100ms'
      );
    });

    it('should log errors on query failure', async () => {
      const { logger } = await import('@/app/lib/logger');
      const { createPrismaMiddleware } = await import('@/app/lib/prismaMiddleware');
      
      const middleware = createPrismaMiddleware();
      const error = new Error('Query failed');

      const params = { model: 'User', action: 'findMany' };
      const next = jest.fn().mockRejectedValue(error);

      await expect(middleware(params as any, next)).rejects.toThrow(error);

      expect(logger.error).toHaveBeenCalledWith(
        '[Prisma] Query failed:',
        expect.objectContaining({
          model: 'User',
          action: 'findMany',
          error: 'Query failed',
        })
      );
    });

    it('should log query metrics in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const { logger } = await import('@/app/lib/logger');
      const { createPrismaMiddleware } = await import('@/app/lib/prismaMiddleware');
      
      const middleware = createPrismaMiddleware();

      const params = { model: 'User', action: 'findMany' };
      const next = jest.fn().mockResolvedValue([]);

      await middleware(params as any, next);

      expect(logger.debug).toHaveBeenCalledWith(
        '[Prisma] Query completed:',
        expect.objectContaining({
          model: 'User',
          action: 'findMany',
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('detectPoolExhaustion', () => {
    it('should detect pool exhaustion', async () => {
      const { logger } = await import('@/app/lib/logger');
      const { detectPoolExhaustion } = await import('@/app/lib/prismaMiddleware');

      const mockClient = {
        $queryRaw: jest.fn().mockResolvedValue([
          { count: BigInt(90), max_conn: '100' }
        ]),
      };

      const isExhausted = await detectPoolExhaustion(mockClient, 0.8);

      expect(isExhausted).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        '[Prisma] Connection pool near exhaustion:',
        expect.objectContaining({
          activeConnections: 90,
          maxConnections: 100,
        })
      );
    });

    it('should not detect exhaustion when under threshold', async () => {
      const { detectPoolExhaustion } = await import('@/app/lib/prismaMiddleware');

      const mockClient = {
        $queryRaw: jest.fn().mockResolvedValue([
          { count: BigInt(50), max_conn: '100' }
        ]),
      };

      const isExhausted = await detectPoolExhaustion(mockClient, 0.9);

      expect(isExhausted).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const { logger } = await import('@/app/lib/logger');
      const { detectPoolExhaustion } = await import('@/app/lib/prismaMiddleware');

      const error = new Error('Query failed');
      const mockClient = {
        $queryRaw: jest.fn().mockRejectedValue(error),
      };

      const isExhausted = await detectPoolExhaustion(mockClient);

      expect(isExhausted).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        '[Prisma] Failed to detect pool exhaustion:',
        error
      );
    });

    it('should use custom threshold', async () => {
      const { detectPoolExhaustion } = await import('@/app/lib/prismaMiddleware');

      const mockClient = {
        $queryRaw: jest.fn().mockResolvedValue([
          { count: BigInt(75), max_conn: '100' }
        ]),
      };

      const isExhausted = await detectPoolExhaustion(mockClient, 0.7);

      expect(isExhausted).toBe(true);
    });
  });
});
