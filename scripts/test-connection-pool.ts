/**
 * Connection Pool Load Testing Script
 * 
 * Tests Prisma connection pool under various load conditions
 * Run with: npx tsx scripts/test-connection-pool.ts
 */

import { prisma, getConnectionPoolMetrics, checkDatabaseHealth } from '../app/lib/prisma';
import { logger } from '../app/lib/logger';

interface LoadTestConfig {
  concurrentRequests: number;
  totalRequests: number;
  delayBetweenRequests: number;
}

interface LoadTestResult {
  success: number;
  failed: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errors: string[];
}

/**
 * Simulate a database query
 */
async function simulateQuery(): Promise<number> {
  const start = Date.now();
  
  try {
    // Perform a simple query
    await prisma.$queryRaw`SELECT 1 as result`;
    return Date.now() - start;
  } catch (error) {
    throw error;
  }
}

/**
 * Run load test with specified configuration
 */
async function runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
  const results: LoadTestResult = {
    success: 0,
    failed: 0,
    avgResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    errors: [],
  };

  const responseTimes: number[] = [];
  const batches = Math.ceil(config.totalRequests / config.concurrentRequests);

  logger.info(`Starting load test: ${config.totalRequests} total requests, ${config.concurrentRequests} concurrent`);

  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(
      config.concurrentRequests,
      config.totalRequests - batch * config.concurrentRequests
    );

    const promises = Array(batchSize)
      .fill(null)
      .map(async () => {
        try {
          const responseTime = await simulateQuery();
          results.success++;
          responseTimes.push(responseTime);
          results.minResponseTime = Math.min(results.minResponseTime, responseTime);
          results.maxResponseTime = Math.max(results.maxResponseTime, responseTime);
        } catch (error) {
          results.failed++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          results.errors.push(errorMsg);
        }
      });

    await Promise.all(promises);

    // Log progress and metrics
    const metrics = await getConnectionPoolMetrics();
    logger.info(`Batch ${batch + 1}/${batches} completed. Pool utilization: ${metrics.utilizationPercent}%`);

    // Small delay between batches
    if (batch < batches - 1 && config.delayBetweenRequests > 0) {
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenRequests));
    }
  }

  if (responseTimes.length > 0) {
    results.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  }

  return results;
}

/**
 * Test connection pool under different scenarios
 */
async function runTests() {
  console.log('\n=== Connection Pool Load Testing ===\n');

  // Test 1: Health Check
  console.log('Test 1: Database Health Check');
  const isHealthy = await checkDatabaseHealth();
  console.log(`✓ Database is ${isHealthy ? 'healthy' : 'unhealthy'}\n`);

  if (!isHealthy) {
    console.error('Database is not healthy. Aborting tests.');
    process.exit(1);
  }

  // Test 2: Baseline Metrics
  console.log('Test 2: Baseline Connection Pool Metrics');
  const baselineMetrics = await getConnectionPoolMetrics();
  console.log(`✓ Active connections: ${baselineMetrics.activeConnections}/${baselineMetrics.poolSize}`);
  console.log(`✓ Utilization: ${baselineMetrics.utilizationPercent}%\n`);

  // Test 3: Low Load
  console.log('Test 3: Low Load (10 requests, 2 concurrent)');
  const lowLoadResult = await runLoadTest({
    concurrentRequests: 2,
    totalRequests: 10,
    delayBetweenRequests: 100,
  });
  console.log(`✓ Success: ${lowLoadResult.success}, Failed: ${lowLoadResult.failed}`);
  console.log(`✓ Avg response time: ${lowLoadResult.avgResponseTime.toFixed(2)}ms\n`);

  // Test 4: Medium Load
  console.log('Test 4: Medium Load (50 requests, 10 concurrent)');
  const mediumLoadResult = await runLoadTest({
    concurrentRequests: 10,
    totalRequests: 50,
    delayBetweenRequests: 50,
  });
  console.log(`✓ Success: ${mediumLoadResult.success}, Failed: ${mediumLoadResult.failed}`);
  console.log(`✓ Avg response time: ${mediumLoadResult.avgResponseTime.toFixed(2)}ms`);
  console.log(`✓ Min/Max: ${mediumLoadResult.minResponseTime}ms / ${mediumLoadResult.maxResponseTime}ms\n`);

  // Test 5: High Load (Testing pool limits)
  console.log('Test 5: High Load - Pool Stress Test (100 requests, 20 concurrent)');
  const highLoadResult = await runLoadTest({
    concurrentRequests: 20,
    totalRequests: 100,
    delayBetweenRequests: 10,
  });
  console.log(`✓ Success: ${highLoadResult.success}, Failed: ${highLoadResult.failed}`);
  console.log(`✓ Avg response time: ${highLoadResult.avgResponseTime.toFixed(2)}ms`);
  console.log(`✓ Min/Max: ${highLoadResult.minResponseTime}ms / ${highLoadResult.maxResponseTime}ms`);
  
  if (highLoadResult.failed > 0) {
    console.log(`⚠ Errors encountered: ${highLoadResult.errors.slice(0, 3).join(', ')}`);
  }
  console.log();

  // Test 6: Final Metrics
  console.log('Test 6: Final Connection Pool Metrics');
  const finalMetrics = await getConnectionPoolMetrics();
  console.log(`✓ Active connections: ${finalMetrics.activeConnections}/${finalMetrics.poolSize}`);
  console.log(`✓ Utilization: ${finalMetrics.utilizationPercent}%`);

  // Summary
  console.log('\n=== Test Summary ===');
  const totalSuccess = lowLoadResult.success + mediumLoadResult.success + highLoadResult.success;
  const totalFailed = lowLoadResult.failed + mediumLoadResult.failed + highLoadResult.failed;
  const totalRequests = totalSuccess + totalFailed;

  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Success Rate: ${((totalSuccess / totalRequests) * 100).toFixed(2)}%`);
  console.log(`Failed: ${totalFailed}`);
  
  if (totalFailed === 0) {
    console.log('\n✓ All tests passed! Connection pool is working correctly.');
  } else {
    console.log('\n⚠ Some requests failed. Check connection pool configuration.');
  }
}

// Run tests
runTests()
  .catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
