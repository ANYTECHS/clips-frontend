import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock logger
jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Prisma Client
const mockQueryRaw = jest.fn();
const mockDisconnect = jest.fn();
const mockUse = jest.fn();
const mockOn = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $queryRaw: mockQueryRaw,
    $disconnect: mockDisconnect,
    $use: mockUse,
    $on: mockOn,
  })),
}));

describe('Prisma Connection Pool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (global as any).prisma;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('getConnectionPoolMetrics', () => {
    it('should return connection pool metrics', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(5) }]);

      const { getConnectionPoolMetrics } = await import('@/app/lib/prisma');
      const metrics = await getConnectionPoolMetrics();

      expect(metrics).toMatchObject({
        activeConnections: 5,
        poolSize: 10,
        connectionTimeout: 10000,
        poolIdleTimeout: 30000,
      });
      expect(metrics.utilizationPercent).toBe('50.00');
      expect(metrics.timestamp).toBeDefined();
    });

    it('should log metrics when LOG_POOL_METRICS is enabled', async () => {
      process.env.DATABASE_LOG_POOL_METRICS = 'true';
      mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(3) }]);

      const { logger } = await import('@/app/lib/logger');
      const { getConnectionPoolMetrics } = await import('@/app/lib/prisma');
      
      await getConnectionPoolMetrics();

      expect(logger.info).toHaveBeenCalledWith(
        '[Prisma] Connection pool metrics:',
        expect.objectContaining({
          activeConnections: 3,
        })
      );

      delete process.env.DATABASE_LOG_POOL_METRICS;
    });

    it('should handle errors when fetching metrics', async () => {
      const error = new Error('Database connection failed');
      mockQueryRaw.mockRejectedValueOnce(error);

      const { logger } = await import('@/app/lib/logger');
      const { getConnectionPoolMetrics } = await import('@/app/lib/prisma');

      await expect(getConnectionPoolMetrics()).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith(
        '[Prisma] Failed to get connection pool metrics:',
        error
      );
    });

    it('should calculate utilization correctly at 100%', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(10) }]);

      const { getConnectionPoolMetrics } = await import('@/app/lib/prisma');
      const metrics = await getConnectionPoolMetrics();

      expect(metrics.utilizationPercent).toBe('100.00');
    });
  });

  describe('checkDatabaseHealth', () => {
    it('should return true when database is healthy', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ result: 1 }]);

      const { checkDatabaseHealth } = await import('@/app/lib/prisma');
      const isHealthy = await checkDatabaseHealth();

      expect(isHealthy).toBe(true);
      expect(mockQueryRaw).toHaveBeenCalled();
    });

    it('should return false when database check fails', async () => {
      mockQueryRaw.mockRejectedValueOnce(new Error('Connection refused'));

      const { logger } = await import('@/app/lib/logger');
      const { checkDatabaseHealth } = await import('@/app/lib/prisma');
      const isHealthy = await checkDatabaseHealth();

      expect(isHealthy).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        '[Prisma] Database health check failed:',
        expect.any(Error)
      );
    });
  });

  describe('disconnectPrisma', () => {
    it('should disconnect successfully', async () => {
      mockDisconnect.mockResolvedValueOnce(undefined);

      const { logger } = await import('@/app/lib/logger');
      const { disconnectPrisma } = await import('@/app/lib/prisma');
      
      await disconnectPrisma();

      expect(mockDisconnect).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        '[Prisma] Database connection pool closed successfully'
      );
    });

    it('should handle disconnect errors', async () => {
      const error = new Error('Disconnect failed');
      mockDisconnect.mockRejectedValueOnce(error);

      const { logger } = await import('@/app/lib/logger');
      const { disconnectPrisma } = await import('@/app/lib/prisma');

      await expect(disconnectPrisma()).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith(
        '[Prisma] Error during database disconnect:',
        error
      );
    });
  });

  describe('Connection Pool Configuration', () => {
    it('should use default pool size when not configured', async () => {
      delete process.env.DATABASE_POOL_SIZE;
      mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(5) }]);

      const { getConnectionPoolMetrics } = await import('@/app/lib/prisma');
      const metrics = await getConnectionPoolMetrics();

      expect(metrics.poolSize).toBe(10);
    });

    it('should use custom pool size from environment', async () => {
      process.env.DATABASE_POOL_SIZE = '20';
      mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(5) }]);

      jest.resetModules();
      const { getConnectionPoolMetrics } = await import('@/app/lib/prisma');
      const metrics = await getConnectionPoolMetrics();

      expect(metrics.poolSize).toBe(20);
      delete process.env.DATABASE_POOL_SIZE;
    });
  });

  describe('Prisma Client Initialization', () => {
    it('should register middleware on client creation', async () => {
      const { prisma } = await import('@/app/lib/prisma');
      
      expect(mockUse).toHaveBeenCalled();
    });

    it('should register event listeners', async () => {
      const { prisma } = await import('@/app/lib/prisma');
      
      expect(mockOn).toHaveBeenCalledWith('warn', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });
});
