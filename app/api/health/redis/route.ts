import { NextResponse } from 'next/server';
import {
  isRedisAvailable,
  getRedisHealthMetrics,
  getRedisPoolInfo,
} from '@/app/api/jobs/shared/redisClient';
import { logger } from '@/app/lib/logger';

/**
 * GET /api/health/redis
 * 
 * Returns Redis connection health and metrics
 * Useful for monitoring Redis availability in serverless environments
 */
export async function GET() {
  try {
    const isAvailable = isRedisAvailable();
    const metrics = await getRedisHealthMetrics();
    const poolInfo = await getRedisPoolInfo();

    const response = {
      status: isAvailable && metrics.isHealthy ? 'healthy' : 'unhealthy',
      redis: {
        available: isAvailable,
        ...metrics,
      },
      pool: poolInfo || { message: 'Pool info not available' },
      fallback: {
        active: !isAvailable,
        message: isAvailable 
          ? 'Redis is active' 
          : 'Using in-memory storage as fallback',
      },
      timestamp: new Date().toISOString(),
    };

    if (!isAvailable || !metrics.isHealthy) {
      logger.warn('[Health] Redis is unhealthy or unavailable:', response);
      return NextResponse.json(response, { status: 503 });
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[Health] Redis health check failed:', error);

    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        redis: {
          available: false,
          isHealthy: false,
        },
        fallback: {
          active: true,
          message: 'Using in-memory storage due to error',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
