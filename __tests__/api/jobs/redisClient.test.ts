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

// Mock ioredis
const mockPing = jest.fn();
const mockInfo = jest.fn();
const mockQuit = jest.fn();
const mockDisconnect = jest.fn();
const mockConnect = jest.fn();
const mockOn = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: mockPing,
    info: mockInfo,
    quit: mockQuit,
    disconnect: mockDisconnect,
    connect: mockConnect,
    on: mockOn,
    status: 'ready',
  }));
});

describe('Redis Client Manager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Initialization', () => {
    it('should not create client in test mode', async () => {
      process.env.NODE_ENV = 'test';
      
      const { getRedisClient } = await import('@/app/api/jobs/shared/redisClient');
      const client = getRedisClient();
      
      expect(client).toBeNull();
    });

    it('should create client when REDIS_URL is provided', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      
      const { getRedisClient } = await import('@/app/api/jobs/shared/redisClient');
      const client = getRedisClient();
      
      expect(client).not.toBeNull();
    });

    it('should not create client when REDIS_URL is missing', async () => {
      delete process.env.REDIS_URL;
      
      const { getRedisClient } = await import('@/app/api/jobs/shared/redisClient');
      const client = getRedisClient();
      
      expect(client).toBeNull();
    });

    it('should warn in production when REDIS_URL is missing', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.REDIS_URL;
      
      const { logger } = await import('@/app/lib/logger');
      const { getRedisClient } = await import('@/app/api/jobs/shared/redisClient');
      
      getRedisClient();
      
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('REDIS_URL not configured in production')
      );
    });
  });

  describe('Health Checks', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379';
    });

    it('should return true when Redis responds to PING', async () => {
      mockPing.mockResolvedValue('PONG');
      
      const { checkRedisHealth } = await import('@/app/api/jobs/shared/redisClient');
      const isHealthy = await checkRedisHealth();
      
      expect(isHealthy).toBe(true);
      expect(mockPing).toHaveBeenCalled();
    });

    it('should return false when Redis ping fails', async () => {
      mockPing.mockRejectedValue(new Error('Connection refused'));
      
      const { checkRedisHealth } = await import('@/app/api/jobs/shared/redisClient');
      const isHealthy = await checkRedisHealth();
      
      expect(isHealthy).toBe(false);
    });

    it('should return false when client is null', async () => {
      delete process.env.REDIS_URL;
      
      const { checkRedisHealth } = await import('@/app/api/jobs/shared/redisClient');
      const isHealthy = await checkRedisHealth();
      
      expect(isHealthy).toBe(false);
    });
  });

  describe('Health Metrics', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379';
    });

    it('should return health metrics with status', async () => {
      mockPing.mockResolvedValue('PONG');
      
      const { getRedisHealthMetrics } = await import('@/app/api/jobs/shared/redisClient');
      const metrics = await getRedisHealthMetrics();
      
      expect(metrics).toMatchObject({
        status: expect.any(String),
        uptime: expect.any(Number),
        reconnectAttempts: expect.any(Number),
        isHealthy: expect.any(Boolean),
        timestamp: expect.any(String),
      });
    });

    it('should include lastError when health check fails', async () => {
      const error = new Error('Connection timeout');
      mockPing.mockRejectedValue(error);
      
      const { getRedisHealthMetrics } = await import('@/app/api/jobs/shared/redisClient');
      const metrics = await getRedisHealthMetrics();
      
      expect(metrics.isHealthy).toBe(false);
      expect(metrics.lastError).toBe('Connection timeout');
    });

    it('should show disconnected status when client is null', async () => {
      delete process.env.REDIS_URL;
      
      const { getRedisHealthMetrics } = await import('@/app/api/jobs/shared/redisClient');
      const metrics = await getRedisHealthMetrics();
      
      expect(metrics.status).toBe('disconnected');
      expect(metrics.isHealthy).toBe(false);
    });
  });

  describe('Pool Info', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379';
    });

    it('should return pool info when Redis is available', async () => {
      const mockInfoResponse = 
        'connected_clients:5\r\n' +
        'used_memory_human:1.5M\r\n' +
        'uptime_in_seconds:3600\r\n';
      
      mockInfo.mockResolvedValue(mockInfoResponse);
      
      const { getRedisPoolInfo } = await import('@/app/api/jobs/shared/redisClient');
      const poolInfo = await getRedisPoolInfo();
      
      expect(poolInfo).toEqual({
        connectedClients: 5,
        usedMemory: '1.5M',
        uptimeSeconds: 3600,
      });
    });

    it('should return null when Redis is not available', async () => {
      delete process.env.REDIS_URL;
      
      const { getRedisPoolInfo } = await import('@/app/api/jobs/shared/redisClient');
      const poolInfo = await getRedisPoolInfo();
      
      expect(poolInfo).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockInfo.mockRejectedValue(new Error('Command failed'));
      
      const { getRedisPoolInfo } = await import('@/app/api/jobs/shared/redisClient');
      const poolInfo = await getRedisPoolInfo();
      
      expect(poolInfo).toBeNull();
    });
  });

  describe('Connection Management', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379';
    });

    it('should disconnect gracefully', async () => {
      mockQuit.mockResolvedValue('OK');
      
      const { disconnectRedis } = await import('@/app/api/jobs/shared/redisClient');
      await disconnectRedis();
      
      expect(mockQuit).toHaveBeenCalled();
    });

    it('should force disconnect if graceful quit fails', async () => {
      mockQuit.mockRejectedValue(new Error('Quit failed'));
      
      const { disconnectRedis } = await import('@/app/api/jobs/shared/redisClient');
      await disconnectRedis();
      
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should reconnect manually', async () => {
      mockDisconnect.mockResolvedValue(undefined);
      mockConnect.mockResolvedValue(undefined);
      
      const { reconnectRedis } = await import('@/app/api/jobs/shared/redisClient');
      await reconnectRedis();
      
      expect(mockDisconnect).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalled();
    });

    it('should throw error if reconnection fails', async () => {
      const error = new Error('Connection failed');
      mockConnect.mockRejectedValue(error);
      
      const { reconnectRedis } = await import('@/app/api/jobs/shared/redisClient');
      
      await expect(reconnectRedis()).rejects.toThrow(error);
    });
  });

  describe('Availability Check', () => {
    it('should return true when client is ready', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      
      const { isRedisAvailable } = await import('@/app/api/jobs/shared/redisClient');
      const available = isRedisAvailable();
      
      expect(available).toBe(true);
    });

    it('should return false when client is null', async () => {
      delete process.env.REDIS_URL;
      
      const { isRedisAvailable } = await import('@/app/api/jobs/shared/redisClient');
      const available = isRedisAvailable();
      
      expect(available).toBe(false);
    });
  });
});
