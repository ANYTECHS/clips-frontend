# Database Connection Pooling

This document describes the database connection pooling implementation for the Clips application using Prisma.

## Overview

Connection pooling is implemented to prevent connection exhaustion under high load and improve database performance. The implementation includes:

- Configurable connection pool settings
- Connection timeout handling
- Pool monitoring and metrics
- Automatic reconnection
- Graceful shutdown

## Configuration

### Environment Variables

Add these variables to your `.env.local` file:

```env
# Database URL with optional connection pool parameters
DATABASE_URL=postgresql://user:password@localhost:5432/clips

# Connection pool size (default: 10)
DATABASE_POOL_SIZE=10

# Connection timeout in milliseconds (default: 10000)
DATABASE_CONNECTION_TIMEOUT=10000

# Pool idle timeout in milliseconds (default: 30000)
DATABASE_POOL_IDLE_TIMEOUT=30000

# Enable detailed pool metrics logging (default: false)
DATABASE_LOG_POOL_METRICS=false

# Slow query threshold in milliseconds (default: 1000)
DATABASE_SLOW_QUERY_THRESHOLD=1000
```

### Connection String Parameters

You can also configure pooling via the DATABASE_URL connection string:

```env
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=10
```

## Features

### 1. Connection Pool Management

The Prisma client is configured with a connection pool that:

- Maintains a pool of reusable database connections
- Limits concurrent connections to prevent exhaustion
- Automatically manages connection lifecycle
- Implements connection timeouts

### 2. Monitoring and Metrics

#### Health Check Endpoint

Check database health and pool metrics:

```bash
GET /api/health/database
```

Response:
```json
{
  "status": "healthy",
  "metrics": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "activeConnections": 5,
    "poolSize": 10,
    "connectionTimeout": 10000,
    "poolIdleTimeout": 30000,
    "utilizationPercent": "50.00"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Programmatic Monitoring

```typescript
import { getConnectionPoolMetrics } from '@/app/lib/prisma';

const metrics = await getConnectionPoolMetrics();
console.log(`Pool utilization: ${metrics.utilizationPercent}%`);
```

### 3. Timeout Handling

The middleware automatically handles query timeouts:

```typescript
// Queries that exceed DATABASE_CONNECTION_TIMEOUT are cancelled
// Default: 10 seconds
```

### 4. Slow Query Detection

Slow queries are automatically logged:

```typescript
// Queries exceeding DATABASE_SLOW_QUERY_THRESHOLD are logged
// Default: 1 second
```

### 5. Connection Pool Exhaustion Detection

Monitor when the pool approaches capacity:

```typescript
import { detectPoolExhaustion } from '@/app/lib/prismaMiddleware';

const isExhausted = await detectPoolExhaustion(prisma, 0.9); // 90% threshold
if (isExhausted) {
  console.warn('Connection pool near capacity!');
}
```

## Usage

### Basic Usage

```typescript
import { prisma } from '@/app/lib/prisma';

// All queries automatically use the connection pool
const users = await prisma.user.findMany();
```

### Health Checks

```typescript
import { checkDatabaseHealth } from '@/app/lib/prisma';

const isHealthy = await checkDatabaseHealth();
if (!isHealthy) {
  // Handle unhealthy database
}
```

### Graceful Shutdown

```typescript
import { disconnectPrisma } from '@/app/lib/prisma';

// Automatically called on SIGINT/SIGTERM
// Or manually:
await disconnectPrisma();
```

## Load Testing

Test the connection pool under load:

```bash
# Install tsx if not already installed
npm install -g tsx

# Run the load test
npx tsx scripts/test-connection-pool.ts
```

The test script will:
1. Check database health
2. Run queries at different load levels
3. Monitor pool utilization
4. Report success rates and response times

## Monitoring in Production

### Recommended Monitoring

1. **Pool Utilization**: Alert when > 80%
2. **Connection Timeouts**: Alert on increasing timeout errors
3. **Slow Queries**: Track queries > 1 second
4. **Failed Connections**: Alert on connection failures

### Example Monitoring Setup

```typescript
// Add to your monitoring service
setInterval(async () => {
  const metrics = await getConnectionPoolMetrics();
  
  if (parseFloat(metrics.utilizationPercent) > 80) {
    // Send alert
    console.warn('High pool utilization:', metrics);
  }
}, 60000); // Check every minute
```

## Troubleshooting

### Connection Exhaustion

**Symptoms**: "Too many connections" errors

**Solutions**:
1. Increase `DATABASE_POOL_SIZE`
2. Reduce connection-intensive operations
3. Check for connection leaks (unclosed connections)
4. Consider connection pooling at infrastructure level (PgBouncer)

### Slow Queries

**Symptoms**: Timeouts, high response times

**Solutions**:
1. Optimize slow queries (add indexes)
2. Increase `DATABASE_CONNECTION_TIMEOUT`
3. Review query patterns in logs
4. Consider query result caching

### High Latency

**Symptoms**: Slow response times despite low utilization

**Solutions**:
1. Check network latency to database
2. Review database server performance
3. Optimize query patterns
4. Consider read replicas for read-heavy workloads

## Best Practices

1. **Set Appropriate Pool Size**: 
   - Start with 10 connections
   - Monitor utilization
   - Adjust based on load

2. **Enable Metrics in Development**:
   ```env
   DATABASE_LOG_POOL_METRICS=true
   ```

3. **Monitor in Production**:
   - Set up alerts for high utilization
   - Track slow queries
   - Monitor connection errors

4. **Graceful Shutdown**:
   - Always allow time for connection cleanup
   - Handle SIGTERM properly in deployment

5. **Test Under Load**:
   - Run load tests before production
   - Identify bottlenecks early
   - Adjust configuration based on results

## Performance Tuning

### Recommended Settings by Scale

#### Small Application (< 100 concurrent users)
```env
DATABASE_POOL_SIZE=5
DATABASE_CONNECTION_TIMEOUT=5000
```

#### Medium Application (100-1000 concurrent users)
```env
DATABASE_POOL_SIZE=10
DATABASE_CONNECTION_TIMEOUT=10000
```

#### Large Application (> 1000 concurrent users)
```env
DATABASE_POOL_SIZE=20
DATABASE_CONNECTION_TIMEOUT=15000
```

Consider infrastructure-level pooling (PgBouncer) for very large applications.

## Related Files

- `app/lib/prisma.ts` - Main Prisma client with pooling
- `app/lib/prismaMiddleware.ts` - Timeout and monitoring middleware
- `app/api/health/database/route.ts` - Health check endpoint
- `scripts/test-connection-pool.ts` - Load testing script
- `__tests__/lib/prisma.test.ts` - Connection pool tests

## References

- [Prisma Connection Management](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/connection-management)
- [PostgreSQL Connection Pooling](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [PgBouncer Documentation](https://www.pgbouncer.org/)
