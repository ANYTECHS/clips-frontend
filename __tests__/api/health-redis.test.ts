import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the Redis client functions
jest.mock('@/app/api/jobs/shared/redisClient', () => ({
  isRedisAvailable: jest.fn(),
  getRedisHealthMetrics: jest.fn(),
  getRedisPoolInfo: jest.fn(),
}));

// Mock logger
jest.mock('@/app/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('GET /api/health/redis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return healthy status when Redis is available', async () => {
    const {
      isRedisAvailable,
      getRedisHealthMetrics,
      getRedisPoolInfo,
    } = await import('@/app/api/jobs/shared/redisClient');

    (isRedisAvailable as jest.Mock).mockReturnValue(true);
    (getRedisHealthMetrics as jest.Mock).mockResolvedValue({
      status: 'connected',
      uptime: 60000,
      reconnectAttempts: 0,
      isHealthy: true,
      timestamp: '2024-01-01T00:00:00.000Z',
    });
    (getRedisPoolInfo as jest.Mock).mockResolvedValue({
      connectedClients: 5,
      usedMemory: '1.5M',
      uptimeSeconds: 3600,
    });

    const { GET } = await import('@/app/api/health/redis/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: 'healthy',
      redis: {
        available: true,
        isHealthy: true,
      },
      pool: {
        connectedClients: 5,
      },
      fallback: {
        active: false,
      },
    });
  });

  it('should return unhealthy status when Redis is unavailable', async () => {
    const {
      isRedisAvailable,
      getRedisHealthMetrics,
      getRedisPoolInfo,
    } = await import('@/app/api/jobs/shared/redisClient');

    (isRedisAvailable as jest.Mock).mockReturnValue(false);
    (getRedisHealthMetrics as jest.Mock).mockResolvedValue({
      status: 'disconnected',
      uptime: 60000,
      reconnectAttempts: 3,
      isHealthy: false,
      timestamp: '2024-01-01T00:00:00.000Z',
    });
    (getRedisPoolInfo as jest.Mock).mockResolvedValue(null);

    const { GET } = await import('@/app/api/health/redis/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toMatchObject({
      status: 'unhealthy',
      redis: {
        available: false,
        isHealthy: false,
      },
      fallback: {
        active: true,
        message: 'Using in-memory storage as fallback',
      },
    });
  });

  it('should return unhealthy status when health check fails', async () => {
    const {
      isRedisAvailable,
      getRedisHealthMetrics,
      getRedisPoolInfo,
    } = await import('@/app/api/jobs/shared/redisClient');

    (isRedisAvailable as jest.Mock).mockReturnValue(true);
    (getRedisHealthMetrics as jest.Mock).mockResolvedValue({
      status: 'error',
      uptime: 60000,
      lastError: 'Connection timeout',
      reconnectAttempts: 5,
      isHealthy: false,
      timestamp: '2024-01-01T00:00:00.000Z',
    });
    (getRedisPoolInfo as jest.Mock).mockResolvedValue(null);

    const { GET } = await import('@/app/api/health/redis/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.redis.lastError).toBe('Connection timeout');
  });

  it('should handle errors gracefully', async () => {
    const {
      isRedisAvailable,
      getRedisHealthMetrics,
    } = await import('@/app/api/jobs/shared/redisClient');

    (isRedisAvailable as jest.Mock).mockReturnValue(true);
    (getRedisHealthMetrics as jest.Mock).mockRejectedValue(
      new Error('Health check failed')
    );

    const { GET } = await import('@/app/api/health/redis/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toMatchObject({
      status: 'error',
      message: 'Health check failed',
      redis: {
        available: false,
        isHealthy: false,
      },
      fallback: {
        active: true,
      },
    });
  });

  it('should include pool info when available', async () => {
    const {
      isRedisAvailable,
      getRedisHealthMetrics,
      getRedisPoolInfo,
    } = await import('@/app/api/jobs/shared/redisClient');

    (isRedisAvailable as jest.Mock).mockReturnValue(true);
    (getRedisHealthMetrics as jest.Mock).mockResolvedValue({
      status: 'connected',
      uptime: 120000,
      reconnectAttempts: 0,
      isHealthy: true,
      timestamp: '2024-01-01T00:00:00.000Z',
    });
    (getRedisPoolInfo as jest.Mock).mockResolvedValue({
      connectedClients: 10,
      usedMemory: '2.5M',
      uptimeSeconds: 7200,
    });

    const { GET } = await import('@/app/api/health/redis/route');
    const response = await GET();
    const data = await response.json();

    expect(data.pool).toEqual({
      connectedClients: 10,
      usedMemory: '2.5M',
      uptimeSeconds: 7200,
    });
  });

  it('should show fallback message when pool info unavailable', async () => {
    const {
      isRedisAvailable,
      getRedisHealthMetrics,
      getRedisPoolInfo,
    } = await import('@/app/api/jobs/shared/redisClient');

    (isRedisAvailable as jest.Mock).mockReturnValue(true);
    (getRedisHealthMetrics as jest.Mock).mockResolvedValue({
      status: 'connected',
      uptime: 60000,
      reconnectAttempts: 0,
      isHealthy: true,
      timestamp: '2024-01-01T00:00:00.000Z',
    });
    (getRedisPoolInfo as jest.Mock).mockResolvedValue(null);

    const { GET } = await import('@/app/api/health/redis/route');
    const response = await GET();
    const data = await response.json();

    expect(data.pool).toEqual({
      message: 'Pool info not available',
    });
  });
});
