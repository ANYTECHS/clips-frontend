import { NextResponse } from 'next/server';
import { checkDatabaseHealth, getConnectionPoolMetrics } from '@/app/lib/prisma';
import { logger } from '@/app/lib/logger';

/**
 * GET /api/health/database
 * 
 * Returns database connection pool health and metrics
 */
export async function GET() {
  try {
    const isHealthy = await checkDatabaseHealth();
    
    if (!isHealthy) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          message: 'Database connection failed',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    const metrics = await getConnectionPoolMetrics();

    return NextResponse.json({
      status: 'healthy',
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Health] Database health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
