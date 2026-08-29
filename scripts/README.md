# Scripts

This directory contains utility scripts for the Clips application.

## Infrastructure Verification

### verify-infrastructure.ts

Verifies that both database connection pooling and Redis session sharing are configured correctly.

**Prerequisites:**
- Environment variables configured in `.env.local`
- Dependencies installed (`npm install`)

**Usage:**

```bash
npx tsx scripts/verify-infrastructure.ts
```

**What it checks:**
1. Environment variables (DATABASE_URL, REDIS_URL)
2. Database connection pool health and metrics
3. Redis connection health and metrics
4. Job store operations (read, write, delete)

**Output:**
- ✓ Passed: Component is working correctly
- ✗ Failed: Component has errors
- ⚠ Warning: Component has non-critical issues

**Exit codes:**
- 0: All checks passed
- 1: One or more checks failed

## Connection Pool Load Testing

### test-connection-pool.ts

Tests the Prisma database connection pool under various load conditions.

**Prerequisites:**
- Database must be running and accessible
- `DATABASE_URL` must be configured in `.env.local`
- Prisma client must be generated (`npx prisma generate`)

**Usage:**

```bash
# Install tsx if not already installed
npm install -g tsx

# Run the load test
npx tsx scripts/test-connection-pool.ts
```

**What it tests:**
1. Database health check
2. Baseline connection pool metrics
3. Low load scenario (10 requests, 2 concurrent)
4. Medium load scenario (50 requests, 10 concurrent)
5. High load scenario (100 requests, 20 concurrent)
6. Final pool metrics after load

**Output:**
- Success/failure counts
- Average, min, and max response times
- Pool utilization percentages
- Overall success rate

**Expected Results:**
- All requests should succeed with proper pool configuration
- Utilization should stay below 100%
- Response times should be consistent
- No connection timeout errors

**Troubleshooting:**
- If tests fail with "Too many connections": Increase `DATABASE_POOL_SIZE`
- If tests timeout: Increase `DATABASE_CONNECTION_TIMEOUT`
- If utilization is consistently high: Review pool size and concurrent load

## Other Scripts

### check-performance-budget.js

Validates bundle size against performance budgets after build.

**Usage:**
```bash
npm run build
```
(automatically runs after build)

### check-bundle-size.js

Analyzes and reports on bundle sizes.

**Usage:**
```bash
npm run bundle:check
npm run bundle:report
```
