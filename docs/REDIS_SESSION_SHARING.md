# Redis-Based Session Sharing for Serverless Instances

This document describes the Redis-based session sharing implementation for the Clips application, designed to work in serverless environments like Vercel.

## Overview

The job store uses Redis as the default storage backend in production environments to ensure state consistency across multiple serverless function instances. When Redis is unavailable, the system automatically falls back to in-memory storage.

## Problem Statement

In serverless environments, multiple function instances handle requests concurrently. Without shared storage:
- Job state is isolated to individual instances
- State inconsistency occurs when different instances serve the same user
- SSE (Server-Sent Events) streams may miss updates
- Job progress tracking becomes unreliable

## Solution

Redis provides a shared, persistent storage layer that:
- Maintains consistent state across all instances
- Supports connection pooling for optimal performance
- Automatically falls back to in-memory storage if unavailable
- Includes health monitoring and automatic reconnection

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Instance 1 │     │  Instance 2 │     │  Instance N │
│   (Next.js) │     │   (Next.js) │     │   (Next.js) │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┴───────────────────┘
                           │
                  ┌────────▼────────┐
                  │   Redis Server  │
                  │  (Shared State) │
                  └─────────────────┘
```

## Configuration

### Environment Variables

Add these to your `.env.local` or deployment environment:

```env
# Required: Redis connection URL
REDIS_URL=redis://:password@hostname:6379

# For TLS connections (recommended for production)
REDIS_URL=rediss://:password@hostname:6380

# Optional: Connection pool configuration
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_KEEP_ALIVE=30000
REDIS_MAX_RECONNECT_ATTEMPTS=10
REDIS_HEALTH_CHECK_INTERVAL=30000
```

### Connection URL Formats

**Local Development:**
```env
REDIS_URL=redis://localhost:6379
```

**With Password:**
```env
REDIS_URL=redis://:your_password@hostname:6379
```

**With Username and Password:**
```env
REDIS_URL=redis://username:password@hostname:6379
```

**TLS/SSL (Production):**
```env
REDIS_URL=rediss://:password@hostname:6380
```

**Multiple Databases:**
```env
REDIS_URL=redis://hostname:6379/2
```

## Features

### 1. Connection Pooling

The Redis client is configured with connection pooling for optimal performance:

- **Max Retries**: Automatically retries failed commands (default: 3)
- **Retry Delay**: Exponential backoff between retries (default: 1000ms)
- **Connection Timeout**: Max time to establish connection (default: 10000ms)
- **Command Timeout**: Max time for command execution (default: 5000ms)
- **Keep Alive**: TCP keep-alive interval (default: 30000ms)

### 2. Automatic Fallback

When Redis is unavailable, the system automatically falls back to in-memory storage:

```typescript
// Automatic fallback - no code changes needed
const job = await jobStore.get('job-123');
// Works with Redis OR in-memory storage
```

**Fallback Triggers:**
- Redis URL not configured
- Redis connection failed
- Redis health check failed
- Max reconnection attempts exceeded

### 3. Health Monitoring

Built-in health monitoring with periodic checks:

```typescript
import { checkRedisHealth, getRedisHealthMetrics } from '@/app/api/jobs/shared/redisClient';

// Simple health check
const isHealthy = await checkRedisHealth();

// Detailed metrics
const metrics = await getRedisHealthMetrics();
console.log(metrics);
// {
//   status: 'connected',
//   uptime: 120000,
//   lastError: undefined,
//   reconnectAttempts: 0,
//   isHealthy: true,
//   timestamp: '2024-01-01T00:00:00.000Z'
// }
```

### 4. Health Check Endpoints

Monitor Redis status via HTTP:

```bash
# Check Redis health
curl http://localhost:3000/api/health/redis
```

Response when healthy:
```json
{
  "status": "healthy",
  "redis": {
    "available": true,
    "status": "connected",
    "uptime": 120000,
    "reconnectAttempts": 0,
    "isHealthy": true,
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "pool": {
    "connectedClients": 5,
    "usedMemory": "1.5M",
    "uptimeSeconds": 3600
  },
  "fallback": {
    "active": false,
    "message": "Redis is active"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Response when unhealthy:
```json
{
  "status": "unhealthy",
  "redis": {
    "available": false,
    "status": "disconnected",
    "isHealthy": false
  },
  "fallback": {
    "active": true,
    "message": "Using in-memory storage as fallback"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 5. Automatic Reconnection

The client automatically attempts to reconnect on connection loss:

- Exponential backoff between attempts
- Configurable max reconnection attempts
- Offline command queueing during reconnection
- Automatic fallback after max attempts

### 6. Connection Pool Info

Get detailed pool statistics:

```typescript
import { getRedisPoolInfo } from '@/app/api/jobs/shared/redisClient';

const poolInfo = await getRedisPoolInfo();
console.log(poolInfo);
// {
//   connectedClients: 5,
//   usedMemory: '1.5M',
//   uptimeSeconds: 3600
// }
```

## Usage

### Basic Usage

The job store automatically uses Redis when configured:

```typescript
import { jobStore } from '@/app/api/jobs/shared/jobStore';

// Store a job
await jobStore.set('job-123', {
  id: 'job-123',
  userId: 'user-456',
  status: 'processing',
  progress: 50,
  // ... other fields
});

// Retrieve a job
const job = await jobStore.get('job-123');

// Get all jobs for a user
const userJobs = await jobStore.getUserJobs('user-456');

// Delete a job
await jobStore.delete('job-123');
```

### Manual Connection Management

For advanced use cases:

```typescript
import {
  getRedisClient,
  isRedisAvailable,
  disconnectRedis,
  reconnectRedis,
} from '@/app/api/jobs/shared/redisClient';

// Get the raw Redis client
const client = getRedisClient();

// Check availability
if (isRedisAvailable()) {
  // Use Redis
} else {
  // Use fallback
}

// Manual reconnection
await reconnectRedis();

// Graceful shutdown
await disconnectRedis();
```

## Deployment

### Vercel

1. Add Redis URL to environment variables:
   ```bash
   vercel env add REDIS_URL
   ```

2. Enter your Redis connection string:
   ```
   rediss://:password@your-redis-host:6380
   ```

3. Deploy:
   ```bash
   vercel deploy
   ```

### Docker

```dockerfile
ENV REDIS_URL=redis://redis-container:6379
```

### Kubernetes

```yaml
env:
  - name: REDIS_URL
    valueFrom:
      secretKeyRef:
        name: redis-credentials
        key: url
```

## Redis Providers

### Upstash (Recommended for Vercel)

1. Create account at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy the connection string
4. Add to environment variables

**Pricing:** Free tier available, pay-per-request after that.

### Redis Cloud

1. Create account at [redis.com](https://redis.com)
2. Create a database
3. Copy the connection string
4. Add to environment variables

**Pricing:** Free tier with 30MB storage.

### AWS ElastiCache

1. Create Redis cluster in AWS
2. Configure VPC and security groups
3. Use connection endpoint as REDIS_URL

**Pricing:** Based on instance size and usage.

### Azure Cache for Redis

1. Create Redis cache in Azure portal
2. Get connection string from Access keys
3. Add to environment variables

**Pricing:** Based on tier and size.

## Monitoring

### Production Monitoring

Set up alerts for:

1. **Redis Availability**
   - Alert when fallback is active
   - Monitor health check endpoint

2. **Connection Pool**
   - Alert on high connected clients
   - Monitor memory usage

3. **Performance**
   - Track command response times
   - Monitor reconnection attempts

### Example Monitoring Setup

```typescript
// Check health every minute
setInterval(async () => {
  const metrics = await getRedisHealthMetrics();
  
  if (!metrics.isHealthy) {
    // Send alert
    console.error('Redis unhealthy:', metrics);
  }
  
  if (metrics.reconnectAttempts > 5) {
    // Send warning
    console.warn('High reconnection attempts:', metrics);
  }
}, 60000);
```

## Troubleshooting

### Redis Connection Fails

**Symptoms:**
- Logs show "Redis not available"
- Fallback to in-memory storage

**Solutions:**
1. Verify REDIS_URL is correct
2. Check Redis server is running
3. Verify network connectivity
4. Check firewall rules
5. Ensure TLS configuration matches (redis:// vs rediss://)

### Connection Timeout

**Symptoms:**
- Connection timeout errors
- Slow reconnection

**Solutions:**
1. Increase `REDIS_CONNECT_TIMEOUT`
2. Check network latency
3. Verify Redis server performance
4. Consider Redis server closer to deployment region

### High Memory Usage

**Symptoms:**
- Redis memory growing
- Out of memory errors

**Solutions:**
1. Implement TTL for job keys
2. Clean up completed jobs regularly
3. Monitor key count
4. Consider Redis eviction policies

### State Inconsistency

**Symptoms:**
- Jobs not updating across instances
- SSE streams missing updates

**Solutions:**
1. Verify Redis is connected (check health endpoint)
2. Ensure all instances use same REDIS_URL
3. Check for network partitions
4. Review job update logic

## Best Practices

1. **Always Use TLS in Production**
   ```env
   REDIS_URL=rediss://...
   ```

2. **Set Strong Password**
   ```env
   REDIS_URL=redis://:strong_random_password@...
   ```

3. **Monitor Health**
   - Set up alerts for fallback activation
   - Monitor reconnection attempts
   - Track memory usage

4. **Implement TTL**
   ```typescript
   await client.setex('job:123', 86400, JSON.stringify(job)); // 24h TTL
   ```

5. **Handle Fallback Gracefully**
   - Log when fallback is active
   - Notify users of potential inconsistency
   - Implement cleanup when Redis returns

6. **Test Failover**
   - Simulate Redis unavailability
   - Verify fallback works
   - Test reconnection

7. **Clean Up Old Jobs**
   ```typescript
   // Implement periodic cleanup
   const jobs = await jobStore.getAll();
   const oldJobs = jobs.filter(j => 
     Date.now() - j.createdAt > 7 * 24 * 60 * 60 * 1000
   );
   for (const job of oldJobs) {
     await jobStore.delete(job.id);
   }
   ```

## Performance Tuning

### Connection Pool Size

For high-traffic applications:

```env
# Allow more reconnection attempts
REDIS_MAX_RECONNECT_ATTEMPTS=20

# Reduce command timeout for faster failover
REDIS_COMMAND_TIMEOUT=3000

# Increase keep-alive for stable connections
REDIS_KEEP_ALIVE=60000
```

### Redis Server Configuration

```conf
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
timeout 300
tcp-keepalive 60
```

## Related Files

- `app/api/jobs/shared/redisClient.ts` - Redis client manager
- `app/api/jobs/shared/jobRepository.ts` - Job storage repository
- `app/api/jobs/shared/jobStore.ts` - Job store interface
- `app/api/health/redis/route.ts` - Health check endpoint
- `__tests__/api/jobs/redisClient.test.ts` - Redis client tests
- `__tests__/api/health-redis.test.ts` - Health endpoint tests

## References

- [ioredis Documentation](https://github.com/luin/ioredis)
- [Redis Commands](https://redis.io/commands/)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Upstash Redis](https://docs.upstash.com/redis)
