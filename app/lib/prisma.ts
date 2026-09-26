import { PrismaClient } from '@prisma/client';
import { logger } from '@/app/lib/logger';
import { createPrismaMiddleware } from '@/app/lib/prismaMiddleware';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Connection pool configuration
const CONNECTION_POOL_SIZE = parseInt(process.env.DATABASE_POOL_SIZE || '10', 10);
const CONNECTION_TIMEOUT = parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '10000', 10);
const POOL_IDLE_TIMEOUT = parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT || '30000', 10);
const LOG_POOL_METRICS = process.env.DATABASE_LOG_POOL_METRICS === 'true';

/**
 * Creates a configured Prisma client with connection pooling
 */
function createPrismaClient() {
  const client = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'query', emit: LOG_POOL_METRICS ? 'event' : 'stdout' },
    ],
  });

  // Register middleware for timeout handling and monitoring
  client.$use(createPrismaMiddleware());

  // Log warnings
  client.$on('warn' as never, (e: any) => {
    logger.warn('[Prisma] Warning:', e);
  });

  // Log errors
  client.$on('error' as never, (e: any) => {
    logger.error('[Prisma] Error:', e);
  });

  // Log query metrics if enabled
  if (LOG_POOL_METRICS) {
    client.$on('query' as never, (e: any) => {
      logger.debug('[Prisma] Query:', {
        query: e.query,
        duration: `${e.duration}ms`,
        params: e.params,
      });
    });
  }

  return client;
}

/**
 * Singleton Prisma client with connection pooling
 */
export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Connection pool monitoring
 */
export async function getConnectionPoolMetrics() {
  try {
    // Execute a lightweight query to check pool health
    const result = await prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM pg_stat_activity WHERE datname = current_database()`;
    
    const activeConnections = Number(result[0].count);
    
    const metrics = {
      timestamp: new Date().toISOString(),
      activeConnections,
      poolSize: CONNECTION_POOL_SIZE,
      connectionTimeout: CONNECTION_TIMEOUT,
      poolIdleTimeout: POOL_IDLE_TIMEOUT,
      utilizationPercent: ((activeConnections / CONNECTION_POOL_SIZE) * 100).toFixed(2),
    };

    if (LOG_POOL_METRICS) {
      logger.info('[Prisma] Connection pool metrics:', metrics);
    }

    return metrics;
  } catch (error) {
    logger.error('[Prisma] Failed to get connection pool metrics:', error);
    throw error;
  }
}

/**
 * Graceful shutdown handler
 */
export async function disconnectPrisma() {
  try {
    await prisma.$disconnect();
    logger.info('[Prisma] Database connection pool closed successfully');
  } catch (error) {
    logger.error('[Prisma] Error during database disconnect:', error);
    throw error;
  }
}

// Handle graceful shutdown
if (typeof process !== 'undefined') {
  const cleanup = () => {
    disconnectPrisma()
      .catch((err) => logger.error('[Prisma] Cleanup error:', err))
      .finally(() => process.exit(0));
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

/**
 * Health check for connection pool
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('[Prisma] Database health check failed:', error);
    return false;
  }
}
