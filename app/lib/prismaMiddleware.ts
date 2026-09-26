import { Prisma } from '@prisma/client';
import { logger } from '@/app/lib/logger';

/**
 * Prisma middleware for connection timeout handling and query monitoring
 */
export function createPrismaMiddleware() {
  const CONNECTION_TIMEOUT = parseInt(
    process.env.DATABASE_CONNECTION_TIMEOUT || '10000',
    10
  );
  const SLOW_QUERY_THRESHOLD = parseInt(
    process.env.DATABASE_SLOW_QUERY_THRESHOLD || '1000',
    10
  );

  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<any>
  ) => {
    const start = Date.now();

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Database query timeout after ${CONNECTION_TIMEOUT}ms`));
        }, CONNECTION_TIMEOUT);
      });

      // Race between the actual query and timeout
      const result = await Promise.race([next(params), timeoutPromise]);

      const duration = Date.now() - start;

      // Log slow queries
      if (duration > SLOW_QUERY_THRESHOLD) {
        logger.warn('[Prisma] Slow query detected:', {
          model: params.model,
          action: params.action,
          duration: `${duration}ms`,
        });
      }

      // Log query metrics in development
      if (process.env.NODE_ENV !== 'production') {
        logger.debug('[Prisma] Query completed:', {
          model: params.model,
          action: params.action,
          duration: `${duration}ms`,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('[Prisma] Query failed:', {
        model: params.model,
        action: params.action,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw the error for proper error handling
      throw error;
    }
  };
}

/**
 * Connection pool exhaustion detector
 */
export async function detectPoolExhaustion(
  prismaClient: any,
  threshold = 0.9
): Promise<boolean> {
  try {
    const result = await prismaClient.$queryRaw<[{ count: bigint; max_conn: string }]>`
      SELECT 
        COUNT(*) as count,
        current_setting('max_connections') as max_conn
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;

    const activeConnections = Number(result[0].count);
    const maxConnections = parseInt(result[0].max_conn, 10);
    const utilization = activeConnections / maxConnections;

    if (utilization >= threshold) {
      logger.warn('[Prisma] Connection pool near exhaustion:', {
        activeConnections,
        maxConnections,
        utilization: `${(utilization * 100).toFixed(2)}%`,
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.error('[Prisma] Failed to detect pool exhaustion:', error);
    return false;
  }
}
