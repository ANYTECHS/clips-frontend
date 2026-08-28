import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextResponse } from 'next/server';

// Mock the Prisma functions
jest.mock('@/app/lib/prisma', () => ({
  checkDatabaseHealth: jest.fn(),
  getConnectionPoolMetrics: jest.fn(),
}));

// Mock logger
jest.mock('@/app/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('GET /api/health/database', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return healthy status with metrics', async () => {
    const { checkDatabaseHealth, getConnectionPoolMetrics } = await import('@/app/lib/prisma');
    
    (checkDatabaseHealth as jest.Mock).mockResolvedValue(true);
    (getConnectionPoolMetrics as jest.Mock).mockResolvedValue({
      timestamp: '2024-01-01T00:00:00.000Z',
      activeConnections: 5,
      poolSize: 10,
      connectionTimeout: 10000,
      poolIdleTimeout: 30000,
      utilizationPercent: '50.00',
    });

    const { GET } = await import('@/app/api/health/database/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: 'healthy',
      metrics: {
        activeConnections: 5,
        poolSize: 10,
        utilizationPercent: '50.00',
      },
    });
    expect(data.timestamp).toBeDefined();
  });

  it('should return unhealthy status when database check fails', async () => {
    const { checkDatabaseHealth } = await import('@/app/lib/prisma');
    
    (checkDatabaseHealth as jest.Mock).mockResolvedValue(false);

    const { GET } = await import('@/app/api/health/database/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toMatchObject({
      status: 'unhealthy',
      message: 'Database connection failed',
    });
  });

  it('should handle errors gracefully', async () => {
    const { checkDatabaseHealth } = await import('@/app/lib/prisma');
    const { logger } = await import('@/app/lib/logger');
    
    const error = new Error('Connection refused');
    (checkDatabaseHealth as jest.Mock).mockRejectedValue(error);

    const { GET } = await import('@/app/api/health/database/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toMatchObject({
      status: 'error',
      message: 'Connection refused',
    });
    expect(logger.error).toHaveBeenCalledWith(
      '[Health] Database health check failed:',
      error
    );
  });

  it('should handle non-Error exceptions', async () => {
    const { checkDatabaseHealth } = await import('@/app/lib/prisma');
    
    (checkDatabaseHealth as jest.Mock).mockRejectedValue('String error');

    const { GET } = await import('@/app/api/health/database/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe('String error');
  });
});
