# Redis Session Sharing - Quick Start Guide

Quick reference for setting up Redis-based session sharing in the Clips application.

## 5-Minute Setup

### 1. Get Redis URL

**Option A: Upstash (Recommended for Vercel)**
1. Go to [upstash.com](https://upstash.com)
2. Create account and database
3. Copy "Redis URL"

**Option B: Local Development**
```bash
# Start Redis with Docker
docker run -d -p 6379:6379 redis:alpine

# Your URL:
redis://localhost:6379
```

**Option C: Redis Cloud**
1. Go to [redis.com](https://redis.com)
2. Create free account and database
3. Copy connection string

### 2. Configure Environment

**Local Development (.env.local):**
```env
REDIS_URL=redis://localhost:6379
```

**Production (Vercel):**
```bash
vercel env add REDIS_URL
# Paste: rediss://:password@host:6380
```

### 3. Verify Setup

```bash
# Start app
npm run dev

# Check health
curl http://localhost:3000/api/health/redis

# Should see: "status": "healthy"
```

## That's It! 

Your app now shares state across all serverless instances.

## Common Configurations

### Development (No Redis)
```env
# Leave REDIS_URL unset
# App automatically uses in-memory storage
```

### Development (With Local Redis)
```env
REDIS_URL=redis://localhost:6379
```

### Production (Upstash)
```env
REDIS_URL=rediss://:abc123...@us1-example.upstash.io:6380
```

### Production (Redis Cloud)
```env
REDIS_URL=rediss://:password@redis-12345.cloud.redislabs.com:6380
```

## Troubleshooting

### "Redis not available" in logs

**If Development:**
- This is normal without REDIS_URL
- App uses in-memory storage
- Set REDIS_URL to use Redis

**If Production:**
- Check REDIS_URL is set in deployment
- Verify Redis server is running
- Test connection: `redis-cli -u $REDIS_URL ping`

### Health check returns 503

```bash
# Check status
curl http://localhost:3000/api/health/redis

# Look for error in redis.lastError field
# Common issues:
# - Wrong URL format
# - Redis server down
# - Firewall blocking connection
# - Wrong TLS config (redis:// vs rediss://)
```

### Jobs not syncing across instances

1. **Verify Redis is connected:**
   ```bash
   curl https://your-app.vercel.app/api/health/redis
   # Should show: "available": true
   ```

2. **Check all instances use same REDIS_URL:**
   ```bash
   vercel env ls
   # Verify REDIS_URL exists for production
   ```

3. **Review logs for fallback warnings:**
   ```
   Look for: "Using in-memory storage as fallback"
   ```

## Optional: Advanced Configuration

Add to `.env.local` or deployment environment:

```env
# Increase timeouts for slow connections
REDIS_CONNECT_TIMEOUT=15000
REDIS_COMMAND_TIMEOUT=10000

# More aggressive reconnection
REDIS_MAX_RECONNECT_ATTEMPTS=20

# Faster health checks
REDIS_HEALTH_CHECK_INTERVAL=15000
```

## Monitoring

### Quick Health Check
```bash
curl https://your-app.vercel.app/api/health/redis
```

### Watch for Issues
```javascript
// Add to monitoring service
setInterval(async () => {
  const res = await fetch('/api/health/redis');
  const { status } = await res.json();
  if (status !== 'healthy') alert('Redis down!');
}, 60000);
```

## Need Help?

- **Full Documentation**: `docs/REDIS_SESSION_SHARING.md`
- **Troubleshooting**: See full doc for detailed solutions
- **Configuration**: See `.env.example` for all options

## Testing Checklist

- [ ] Health endpoint returns 200
- [ ] redis.available is true
- [ ] redis.isHealthy is true
- [ ] fallback.active is false
- [ ] Job updates work across browser tabs
- [ ] SSE streams receive updates

## Quick Commands

```bash
# Local Redis with Docker
docker run -d -p 6379:6379 redis:alpine

# Test connection
redis-cli -u $REDIS_URL ping

# Check health
curl http://localhost:3000/api/health/redis

# Stop Redis (test fallback)
docker stop $(docker ps -q --filter ancestor=redis:alpine)

# Restart Redis (test reconnection)
docker start $(docker ps -aq --filter ancestor=redis:alpine)
```

## Architecture

```
User Request → Vercel Edge → Instance 1 ─┐
                           → Instance 2 ─┼→ Redis (Shared State)
                           → Instance N ─┘
```

All instances read/write to the same Redis server, ensuring state consistency.

## What Gets Stored

- Job IDs and metadata
- Job status (queued, processing, complete, error)
- Progress percentages
- Moments found
- Error messages
- User associations

## What Doesn't Get Stored

- Video files (stored in S3)
- User sessions (handled by NextAuth)
- Temporary data (handled by API routes)

## Fallback Behavior

When Redis is unavailable:
- ✅ App continues working
- ✅ Uses in-memory storage
- ⚠️ State NOT shared across instances
- ⚠️ Job updates may be missed by SSE streams
- ℹ️ Logs warning messages

## Production Checklist

- [ ] REDIS_URL uses TLS (rediss://)
- [ ] Strong password configured
- [ ] Health monitoring set up
- [ ] Alerts configured for downtime
- [ ] Tested failover scenario
- [ ] Documented connection string location
- [ ] Backup Redis provider identified

## Support

For detailed information, see:
- `docs/REDIS_SESSION_SHARING.md` - Complete guide
- `ISSUE_852_COMPLETION.md` - Implementation details
- `.env.example` - Configuration reference
