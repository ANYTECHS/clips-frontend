# Auto-Scaling Configuration

This document covers all scaling triggers, limits, cooldown periods, and operational runbooks for each supported deployment platform.

---

## 1. Architecture Overview

The ClipCash frontend is a stateless Next.js App Router application. Scaling it horizontally is safe as long as Redis is configured — job state lives in Redis, not in process memory.

```
Users → Load Balancer → N × Next.js instances → Redis (job store)
                                               → S3 (file storage)
                                               → AI Backend (async)
```

**Statefulness requirements before scaling beyond 1 instance:**
- `REDIS_URL` must be set. Without it each instance uses an in-memory store that is not shared.
- Redis connection pooling is automatically configured for optimal performance in serverless environments.
- The system automatically falls back to in-memory storage if Redis is unavailable (logs warnings).
- The AI backend callback (`POST /api/jobs/[id]/callback`) can land on any instance; all instances read/write the same Redis key, so this is safe.
- SSE streams (`GET /api/jobs/[id]/stream`) poll Redis every 1 s — they work correctly across instances.

**Redis health monitoring:**
- Automatic health checks every 30 seconds (configurable via `REDIS_HEALTH_CHECK_INTERVAL`)
- Health endpoint at `/api/health/redis` for monitoring
- Connection pooling with automatic reconnection on failure
- See `docs/REDIS_SESSION_SHARING.md` for full configuration details

---

## 2. Metrics Endpoint

All scalers consume `GET /api/metrics`.

| Format | How to request |
|--------|---------------|
| Prometheus text | Default (`Accept: text/plain` or no header) |
| JSON | `Accept: application/json` |

**Authentication:** `Authorization: Bearer <METRICS_TOKEN>`

**Rate limit:** 120 req/min per IP.

**Key metrics exposed:**

| Metric | Type | Description |
|--------|------|-------------|
| `clipcash_jobs_queued` | gauge | Jobs waiting for AI dispatch |
| `clipcash_jobs_active` | gauge | Jobs currently processing |
| `clipcash_jobs_failed` | gauge | Jobs in error terminal state |
| `clipcash_jobs_complete` | gauge | Jobs completed successfully |
| `clipcash_process_uptime_seconds` | gauge | Process uptime |
| `clipcash_process_memory_rss_bytes` | gauge | RSS memory |
| `clipcash_process_memory_heap_bytes` | gauge | V8 heap used |
| `clipcash_circuit_breaker_state{service}` | gauge | 0=CLOSED, 1=HALF_OPEN, 2=OPEN |
| `clipcash_circuit_breaker_failures{service}` | gauge | Consecutive failure count |
| `clipcash_circuit_breaker_total_calls{service}` | counter | Total calls through breaker |
| `clipcash_circuit_breaker_total_fallbacks{service}` | counter | Total fallback invocations |

---

## 3. Vercel (Serverless)

Vercel scales functions automatically — there is no replica count to manage. Configuration focuses on per-function resource limits, cron jobs, and preventing runaway execution.

### Function configuration (`vercel.json`)

| Function | Memory | Max duration | Reason |
|----------|--------|-------------|--------|
| `/api/upload` | 3008 MB | 60 s | Holds full video buffer in memory during virus scan |
| `/api/jobs/[id]/stream` | 256 MB | 300 s | SSE streams stay open for the full processing duration |
| `/api/jobs/[id]/callback` | 256 MB | 10 s | Fast write, no heavy computation |
| `/api/health` | 128 MB | 5 s | Liveness — should never need more |
| `/api/health/ready` | 256 MB | 15 s | Probes Redis + S3 + AI backend concurrently |
| `/api/metrics` | 256 MB | 15 s | Reads all jobs from Redis |

### Scaling triggers (Vercel-managed)

Vercel scales invocations to zero between requests and spins up new instances on demand. There are no user-configurable scale-out thresholds.

**What you control:**
- **Concurrency per region** — set via `regions` in `vercel.json`. Add regions to reduce latency for users outside `iad1`.
- **Cold-start mitigation** — enable Vercel's "Fluid compute" or set a minimum instance count in project settings (Pro/Enterprise plans).

### Cron jobs

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/requeue-stalled-jobs` | Every 5 min | Re-dispatches jobs stuck in `queued` > 10 min |
| `/api/cron/cleanup-old-jobs` | Daily 03:00 UTC | Deletes terminal jobs older than 7 days |

Both endpoints require `Authorization: Bearer <CRON_SECRET>`. Vercel injects this automatically when the cron is triggered via `vercel.json`.

**Tunable env vars:**

| Variable | Default | Effect |
|----------|---------|--------|
| `STALLED_JOB_THRESHOLD_MS` | `600000` | Age (ms) before a queued job is considered stalled |
| `REQUEUE_MAX_JOBS` | `20` | Max jobs re-dispatched per cron run |
| `CLEANUP_JOB_AGE_MS` | `604800000` | Age (ms) before a terminal job is deleted (7 days) |
| `CLEANUP_MAX_JOBS` | `500` | Max jobs deleted per cleanup run |

---

## 4. Kubernetes

All manifests are in `deploy/k8s/`. Apply in this order:

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/secret.yaml        # fill in real values first
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/deployment.yaml
kubectl apply -f deploy/k8s/service.yaml
kubectl apply -f deploy/k8s/pdb.yaml
kubectl apply -f deploy/k8s/hpa-cpu-memory.yaml
kubectl apply -f deploy/k8s/hpa-queue-depth.yaml   # requires KEDA
kubectl apply -f deploy/k8s/cronjob-requeue.yaml
kubectl apply -f deploy/k8s/cronjob-cleanup.yaml
kubectl apply -f deploy/k8s/servicemonitor.yaml    # requires prometheus-operator
```

### HPA 1 — CPU + Memory (`hpa-cpu-memory.yaml`)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Min replicas | 2 | HA across zones; supports zero-downtime rolling updates |
| Max replicas | 10 | Hard cap against runaway scaling |
| CPU scale-out | 60% of 250m request | Triggers before Node.js event loop saturation (~80%) |
| Memory scale-out | 70% of 512Mi request | ~358 Mi; buffer before OOMKill |
| Scale-up stabilisation | 30 s | Reacts quickly to traffic spikes |
| Scale-up policy | Max(+2 pods/30s, +100%/60s) | Aggressive during spikes |
| Scale-down stabilisation | 300 s (5 min) | Prevents thrash on brief lulls |
| Scale-down policy | Min(−1 pod/120s) | Slow removal keeps SSE streams alive |

### HPA 2 — Queue depth (`hpa-queue-depth.yaml`, requires KEDA)

Install KEDA:
```bash
helm repo add kedacore https://kedacore.github.io/charts
helm install keda kedacore/keda --namespace keda --create-namespace
```

Create the metrics token secret before applying:
```bash
kubectl create secret generic clipcash-metrics-token \
  --from-literal=token=<METRICS_TOKEN> \
  -n clipcash
```

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Min replicas | 2 | Same floor as CPU/memory HPA |
| Max replicas | 10 | Same ceiling |
| Poll interval | 30 s | Matches Prometheus scrape interval |
| Cooldown period | 300 s | 5 min idle before scaling to min |
| Queued jobs target | 5 per replica | 20 queued jobs → 4 replicas |
| Active jobs target | 8 per replica | 24 active jobs → 3 replicas |
| Scale-up stabilisation | 30 s | Mirrors CPU/memory HPA |
| Scale-down stabilisation | 300 s | Mirrors CPU/memory HPA |

Kubernetes takes the **maximum** desired replica count across all active HPAs, so whichever trigger calls for more replicas wins.

### PodDisruptionBudget

`pdb.yaml` ensures at least 1 pod stays running during node drains, cluster upgrades, and rolling deployments. With `minReplicas: 2` this means at most 1 pod is evicted at a time.

### CronJobs

The Kubernetes `CronJob` resources in `cronjob-requeue.yaml` and `cronjob-cleanup.yaml` use a `curlimages/curl` container to call the same cron endpoints as Vercel. Both use `concurrencyPolicy: Forbid` so overlapping runs are never started.

### Plain Prometheus scrape config (no operator)

If you are not using the Prometheus Operator, add this to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: clipcash-frontend
    scrape_interval: 30s
    scrape_timeout: 10s
    bearer_token: <METRICS_TOKEN>
    static_configs:
      - targets: ['clipcash-frontend.clipcash.svc.cluster.local:80']
    metrics_path: /api/metrics
```

---

## 5. Fly.io

Configuration is in `fly.toml`. Deploy with:

```bash
fly launch   # first time
fly deploy   # subsequent deploys
```

Set secrets before first deploy:
```bash
fly secrets set \
  NEXTAUTH_SECRET=<value> \
  NEXTAUTH_URL=https://<app-name>.fly.dev \
  REDIS_URL=<value> \
  AI_BACKEND_CALLBACK_SECRET=<value> \
  AI_BACKEND_SECRET=<value> \
  AWS_ACCESS_KEY_ID=<value> \
  AWS_SECRET_ACCESS_KEY=<value> \
  CLOUD_STORAGE_BUCKET=<value> \
  CRON_SECRET=<value> \
  METRICS_TOKEN=<value> \
  NEXT_PUBLIC_SENTRY_DSN=<value>
```

### Scaling triggers

| Trigger | Value | Effect |
|---------|-------|--------|
| Concurrency soft limit | 50 requests | Fly starts a new machine when a machine handles 50 concurrent requests |
| Concurrency hard limit | 75 requests | Requests above 75 are rejected with 503 |
| Auto-stop idle timeout | 10 min | Machine stopped after 10 min of no traffic |
| Min machines running | 1 | Always keep 1 machine warm to avoid cold starts |

### Cooldown behaviour

Fly does not have an explicit scale-down cooldown like Kubernetes HPA. Instead:
- The `idle_timeout = "10m"` setting acts as the cooldown — a machine that handled traffic recently is not stopped until 10 minutes of inactivity.
- SSE stream connections (up to 5 min) keep a machine active for their full duration.
- `min_machines_running = 1` guarantees at least one machine is always ready.

### Multi-region

Uncomment the `[[regions]]` sections in `fly.toml` to add geographic regions. Each region maintains its own machine pool with the same auto-stop/start rules.

### Fly.io metrics

`fly.toml` configures the built-in Prometheus scrape:
```toml
[metrics]
  port = 3000
  path = "/api/metrics"
```

Metrics appear in the Fly.io dashboard under **Metrics** → **Custom**. You can also connect an external Prometheus instance using Fly's Prometheus endpoint.

---

## 6. Grafana Dashboard

Import `deploy/grafana/scaling-dashboard.json` into Grafana:

**Via UI:**
1. Dashboards → Import → Upload JSON file → select `scaling-dashboard.json`
2. Select your Prometheus datasource when prompted

**Via provisioning (Kubernetes):**
```bash
# Create a ConfigMap from the dashboard JSON
kubectl create configmap clipcash-grafana-dashboard \
  --from-file=scaling-dashboard.json=deploy/grafana/scaling-dashboard.json \
  -n monitoring

# Mount it in your Grafana deployment under:
# /var/lib/grafana/dashboards/clipcash/scaling-dashboard.json
# and copy deploy/grafana/provisioning/dashboards.yaml to:
# /etc/grafana/provisioning/dashboards/clipcash.yaml
```

### Dashboard panels

| Row | Panels |
|-----|--------|
| Job Queue | Queued stat, Active stat, Failed stat, Queue depth time-series, Total pending gauge |
| Process Resources | Memory RSS+heap time-series, Uptime stat, RSS gauge (1 GiB threshold) |
| Circuit Breakers | State per service (colour-coded), Consecutive failures time-series, Fallback rate/5m time-series |
| Scaling (K8s only) | HPA current/desired/min/max replicas, Pod phase (Running/Pending), HPA summary table |

Auto-refreshes every 30 seconds. Default time range: last 1 hour.

---

## 7. Environment Variable Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `METRICS_TOKEN` | — | Bearer token required to scrape `/api/metrics`. Required in production. |
| `CRON_SECRET` | — | Bearer token for cron endpoint authentication. Required in production. |
| `REDIS_URL` | — | Required for multi-instance deployments. Format: `redis://` or `rediss://` for TLS. |
| `REDIS_MAX_RETRIES` | `3` | Max command retry attempts |
| `REDIS_RETRY_DELAY` | `1000` | Delay between retries in ms |
| `REDIS_CONNECT_TIMEOUT` | `10000` | Connection timeout in ms |
| `REDIS_COMMAND_TIMEOUT` | `5000` | Command execution timeout in ms |
| `REDIS_KEEP_ALIVE` | `30000` | TCP keep-alive interval in ms |
| `REDIS_MAX_RECONNECT_ATTEMPTS` | `10` | Max reconnection attempts before fallback |
| `REDIS_HEALTH_CHECK_INTERVAL` | `30000` | Health check interval in ms |
| `STALLED_JOB_THRESHOLD_MS` | `600000` | Age before a queued job is re-dispatched (10 min) |
| `REQUEUE_MAX_JOBS` | `20` | Max stalled jobs re-dispatched per cron run |
| `CLEANUP_JOB_AGE_MS` | `604800000` | Age before a terminal job is deleted (7 days) |
| `CLEANUP_MAX_JOBS` | `500` | Max terminal jobs deleted per cleanup run |

---

## 8. Scaling Limits Summary

| Platform | Min instances | Max instances | Scale-out trigger | Scale-in cooldown |
|----------|--------------|---------------|-------------------|-------------------|
| Vercel | 0 (serverless) | Unlimited (plan-gated) | Each inbound request | Immediate (idle) |
| Kubernetes (CPU/mem) | 2 | 10 | CPU > 60% or memory > 70% | 5 min (300 s stabilisation) |
| Kubernetes (queue) | 2 | 10 | 5 queued jobs per replica | 5 min (300 s cooldown) |
| Fly.io | 1 (warm) | Unlimited (concurrency-driven) | 50 concurrent requests/machine | 10 min idle timeout |

---

## 9. Operational Runbook

### Queue depth is growing — jobs not being processed

1. Check `/api/health/circuit-breakers` — is `aiBackend` OPEN?
2. Check `/api/health/ready` — is the AI backend reachable?
3. If the AI backend is down, jobs accumulate in `queued` state. They will be automatically re-dispatched by the cron job every 5 minutes once the backend recovers.
4. To manually trigger re-dispatch: `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/requeue-stalled-jobs`
5. On Kubernetes, force an immediate cron run: `kubectl create job --from=cronjob/clipcash-requeue-stalled-jobs manual-requeue -n clipcash`

### Memory usage climbing — approaching OOMKill

1. Check the Grafana "Memory RSS" panel for the trend.
2. If RSS is above 900 Mi on Kubernetes, the HPA should already be scaling out. Verify with `kubectl get hpa -n clipcash`.
3. If not scaling: check that the metrics-server is running (`kubectl top pods -n clipcash`).
4. Emergency: manually scale up: `kubectl scale deployment clipcash-frontend --replicas=5 -n clipcash`
5. Investigate the root cause — a memory leak is likely if RSS grows monotonically even at low job volume.

### Replica count stuck at max

1. The HPA max (10) is a hard cap. If you consistently need more, raise `maxReplicas` in both HPA files and re-apply.
2. Before raising the cap, check whether the bottleneck is actually Redis or the AI backend — more frontend replicas won't help if Redis is saturated.
3. Redis connection pool saturation: Connection pooling is automatically configured. Each Next.js instance maintains a persistent connection to Redis. Check Redis server metrics to ensure it can handle the connection load.
4. Monitor Redis health via `/api/health/redis` endpoint to verify connectivity across all instances.
5. If Redis is the bottleneck, consider:
   - Upgrading your Redis plan for more connections
   - Using Redis Cluster for horizontal scaling
   - Implementing read replicas for read-heavy workloads

### Fly.io: all machines stopped — cold start on first request

1. This is expected if `min_machines_running = 0` (not the default). The default is `1`.
2. If cold starts are unacceptable, set `min_machines_running = 2` in `fly.toml` and redeploy.
3. Check machine status: `fly machines list`
4. Force a machine to start: `fly machines start <machine-id>`

### Cron job not running

**Vercel:** Check the Cron tab in the Vercel dashboard. If the job shows as failed, inspect the function logs for that invocation.

**Kubernetes:** `kubectl get jobs -n clipcash` and `kubectl logs job/<job-name> -n clipcash`

**Fly.io:** Fly cron is in beta. If it fails, trigger manually:
```bash
curl -sf \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<app-name>.fly.dev/api/cron/requeue-stalled-jobs
```

### Redis connection issues

**Symptoms:**
- Logs show "Redis not available" or "Using in-memory storage as fallback"
- `/api/health/redis` returns 503
- Job state inconsistency across instances

**Diagnosis:**
1. Check Redis health: `curl https://<host>/api/health/redis`
2. Review Redis connection logs for error messages
3. Verify `REDIS_URL` is correctly set in all environments
4. Test Redis connectivity: `redis-cli -u $REDIS_URL ping`

**Solutions:**
1. **Connection timeout:** Increase `REDIS_CONNECT_TIMEOUT` and `REDIS_COMMAND_TIMEOUT`
2. **Network issues:** Check firewall rules and security groups
3. **TLS mismatch:** Ensure URL uses `rediss://` for TLS connections
4. **Max connections:** Verify Redis server allows enough connections for your instance count
5. **Temporary outage:** System automatically falls back to in-memory storage and reconnects automatically
6. **Persistent failure:** Check Redis provider status page and connection credentials

**Monitoring:**
- Set up alerts for `/api/health/redis` returning non-200 status
- Monitor `redis.reconnectAttempts` in health metrics
- Track `fallback.active` status to detect when in-memory fallback is used

A circuit breaker opening is a signal of an *external* service failure, not an application capacity problem. Scaling up more replicas will not fix an open circuit breaker. Follow the runbook in `FALLBACK_BEHAVIORS.md` for the affected service.

### Metrics endpoint returning 401

- Verify `METRICS_TOKEN` is set in your environment / secrets.
- In development with no token set, the endpoint accepts unauthenticated requests (logged as a warning).
- In production with no token set, all requests are denied. Set the token and redeploy.
