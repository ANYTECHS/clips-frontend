/**
 * Infrastructure Verification Script
 * 
 * Verifies that both database connection pooling and Redis session sharing
 * are configured correctly and functioning.
 * 
 * Run with: npx tsx scripts/verify-infrastructure.ts
 */

import { logger } from '../app/lib/logger';

interface VerificationResult {
  component: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

/**
 * Check environment variables
 */
function checkEnvironmentVariables(): void {
  console.log('\n=== Checking Environment Variables ===\n');

  // Database variables
  if (process.env.DATABASE_URL) {
    results.push({
      component: 'Database URL',
      status: 'passed',
      message: 'DATABASE_URL is configured',
    });
  } else {
    results.push({
      component: 'Database URL',
      status: 'warning',
      message: 'DATABASE_URL is not set (Prisma features will not work)',
    });
  }

  // Redis variables
  if (process.env.REDIS_URL) {
    results.push({
      component: 'Redis URL',
      status: 'passed',
      message: 'REDIS_URL is configured',
      details: {
        useTLS: process.env.REDIS_URL.startsWith('rediss://'),
      },
    });
  } else {
    results.push({
      component: 'Redis URL',
      status: 'warning',
      message: 'REDIS_URL is not set (will use in-memory storage)',
    });
  }

  // Optional configuration
  const optionalVars = [
    'DATABASE_POOL_SIZE',
    'DATABASE_CONNECTION_TIMEOUT',
    'REDIS_MAX_RETRIES',
    'REDIS_CONNECT_TIMEOUT',
  ];

  const configured = optionalVars.filter(v => process.env[v]);
  if (configured.length > 0) {
    results.push({
      component: 'Optional Configuration',
      status: 'passed',
      message: `${configured.length} optional variables configured`,
      details: configured,
    });
  }
}

/**
 * Check database connection pool
 */
async function checkDatabasePool(): Promise<void> {
  console.log('\n=== Checking Database Connection Pool ===\n');

  if (!process.env.DATABASE_URL) {
    results.push({
      component: 'Database Pool',
      status: 'warning',
      message: 'Skipped (DATABASE_URL not set)',
    });
    return;
  }

  try {
    const { checkDatabaseHealth, getConnectionPoolMetrics } = await import('../app/lib/prisma');

    // Health check
    const isHealthy = await checkDatabaseHealth();
    if (isHealthy) {
      results.push({
        component: 'Database Health',
        status: 'passed',
        message: 'Database is healthy',
      });
    } else {
      results.push({
        component: 'Database Health',
        status: 'failed',
        message: 'Database health check failed',
      });
      return;
    }

    // Pool metrics
    const metrics = await getConnectionPoolMetrics();
    results.push({
      component: 'Database Pool Metrics',
      status: 'passed',
      message: 'Pool metrics retrieved successfully',
      details: {
        activeConnections: metrics.activeConnections,
        poolSize: metrics.poolSize,
        utilization: metrics.utilizationPercent + '%',
      },
    });

    // Check utilization
    const utilization = parseFloat(metrics.utilizationPercent);
    if (utilization > 80) {
      results.push({
        component: 'Database Pool Utilization',
        status: 'warning',
        message: `High pool utilization: ${utilization}%`,
        details: metrics,
      });
    }

  } catch (error) {
    results.push({
      component: 'Database Pool',
      status: 'failed',
      message: 'Failed to check database pool',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Check Redis connection
 */
async function checkRedisConnection(): Promise<void> {
  console.log('\n=== Checking Redis Connection ===\n');

  try {
    const {
      isRedisAvailable,
      checkRedisHealth,
      getRedisHealthMetrics,
      getRedisPoolInfo,
    } = await import('../app/api/jobs/shared/redisClient');

    // Availability check
    const isAvailable = isRedisAvailable();
    if (isAvailable) {
      results.push({
        component: 'Redis Availability',
        status: 'passed',
        message: 'Redis client is available',
      });
    } else {
      results.push({
        component: 'Redis Availability',
        status: 'warning',
        message: 'Redis not available (using in-memory fallback)',
      });
      return;
    }

    // Health check
    const isHealthy = await checkRedisHealth();
    if (isHealthy) {
      results.push({
        component: 'Redis Health',
        status: 'passed',
        message: 'Redis is healthy',
      });
    } else {
      results.push({
        component: 'Redis Health',
        status: 'failed',
        message: 'Redis health check failed',
      });
      return;
    }

    // Health metrics
    const metrics = await getRedisHealthMetrics();
    results.push({
      component: 'Redis Health Metrics',
      status: 'passed',
      message: 'Health metrics retrieved successfully',
      details: {
        status: metrics.status,
        uptime: `${(metrics.uptime / 1000).toFixed(0)}s`,
        reconnectAttempts: metrics.reconnectAttempts,
      },
    });

    // Check reconnection attempts
    if (metrics.reconnectAttempts > 5) {
      results.push({
        component: 'Redis Reconnection',
        status: 'warning',
        message: `High reconnection attempts: ${metrics.reconnectAttempts}`,
        details: metrics,
      });
    }

    // Pool info
    const poolInfo = await getRedisPoolInfo();
    if (poolInfo) {
      results.push({
        component: 'Redis Pool Info',
        status: 'passed',
        message: 'Pool info retrieved successfully',
        details: poolInfo,
      });
    }

  } catch (error) {
    results.push({
      component: 'Redis Connection',
      status: 'failed',
      message: 'Failed to check Redis connection',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Test job store operations
 */
async function testJobStore(): Promise<void> {
  console.log('\n=== Testing Job Store Operations ===\n');

  try {
    const { jobStore } = await import('../app/api/jobs/shared/jobStore');

    const testJobId = `test-${Date.now()}`;
    const testJob = {
      id: testJobId,
      userId: 'test-user',
      status: 'queued' as const,
      progress: 0,
      momentsFound: 0,
      estimatedSecondsRemaining: 0,
      createdAt: Date.now(),
    };

    // Test set
    await jobStore.set(testJobId, testJob);
    results.push({
      component: 'Job Store Write',
      status: 'passed',
      message: 'Successfully stored test job',
    });

    // Test get
    const retrieved = await jobStore.get(testJobId);
    if (retrieved && retrieved.id === testJobId) {
      results.push({
        component: 'Job Store Read',
        status: 'passed',
        message: 'Successfully retrieved test job',
      });
    } else {
      results.push({
        component: 'Job Store Read',
        status: 'failed',
        message: 'Failed to retrieve test job',
      });
    }

    // Test delete
    await jobStore.delete(testJobId);
    const deleted = await jobStore.get(testJobId);
    if (!deleted) {
      results.push({
        component: 'Job Store Delete',
        status: 'passed',
        message: 'Successfully deleted test job',
      });
    } else {
      results.push({
        component: 'Job Store Delete',
        status: 'failed',
        message: 'Failed to delete test job',
      });
    }

  } catch (error) {
    results.push({
      component: 'Job Store Operations',
      status: 'failed',
      message: 'Failed to test job store',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Print results
 */
function printResults(): void {
  console.log('\n=== Verification Results ===\n');

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const warnings = results.filter(r => r.status === 'warning').length;

  for (const result of results) {
    const icon =
      result.status === 'passed' ? '✓' :
      result.status === 'failed' ? '✗' :
      '⚠';

    console.log(`${icon} ${result.component}: ${result.message}`);
    
    if (result.details) {
      console.log(`  Details:`, result.details);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Warnings: ${warnings}`);
  console.log(`Total: ${results.length}`);

  if (failed > 0) {
    console.log('\n⚠ Some checks failed. Review the errors above.');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠ All checks passed with warnings. Review the warnings above.');
    process.exit(0);
  } else {
    console.log('\n✓ All checks passed successfully!');
    process.exit(0);
  }
}

/**
 * Run all checks
 */
async function runVerification(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Infrastructure Verification');
  console.log('Checking database connection pooling and Redis session sharing');
  console.log('='.repeat(60));

  try {
    checkEnvironmentVariables();
    await checkDatabasePool();
    await checkRedisConnection();
    await testJobStore();
  } catch (error) {
    console.error('\nUnexpected error during verification:', error);
    process.exit(1);
  } finally {
    printResults();
  }
}

// Run verification
runVerification().catch((error) => {
  console.error('Verification failed:', error);
  process.exit(1);
});
