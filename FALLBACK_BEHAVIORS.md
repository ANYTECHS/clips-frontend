# Fallback Behaviors for External Dependencies

This document describes how the application handles failures from each external
service, what the degraded experience looks like for users, and which
environment variables control the behavior.

---

## Circuit Breaker Overview

All external service calls are protected by a **circuit breaker** implemented
in `app/lib/circuitBreaker.ts`. The breaker transitions through three states:

| State | Meaning | Behavior |
|-------|---------|----------|
| `CLOSED` | Normal operation | All calls pass through |
| `OPEN` | Service presumed down | Calls are rejected instantly; fallback runs immediately |
| `HALF_OPEN` | Probing for recovery | One call is allowed through; success → CLOSED, failure → OPEN |

Each service has its own breaker instance (process-scoped, reset on worker
restart). Configuration lives in `CIRCUIT_BREAKER_CONFIGS` inside
`circuitBreaker.ts`:

| Service | Failure threshold | Success threshold | Reset timeout |
|---------|-------------------|-------------------|---------------|
| `aiBackend` | 5 consecutive failures | 2 consecutive successes | 60 s |
| `virusScan` | 3 consecutive failures | 2 consecutive successes | 120 s |
| `cloudStorage` | 5 consecutive failures | 2 consecutive successes | 30 s |

The current state of all breakers is exposed at
**`GET /api/health/circuit-breakers`** (rate-limited, no auth required).

---

## 1. AI Backend (`app/lib/aiBackend.ts`)

### What it does
Dispatches video processing jobs to the remote AI service via
`POST {NEXT_PUBLIC_AI_API_URL}/jobs`.

### Failure modes and fallbacks

| Failure | Retry? | Fallback |
|---------|--------|---------|
| Network error / timeout (10 s) | Yes — 3 attempts, 500 ms–4 s backoff | Returns `{ dispatched: false, reason: "AI_BACKEND_UNAVAILABLE" }` |
| HTTP 5xx from AI service | Yes | Same fallback |
| HTTP 4xx (except 429) | No — non-retryable | Returns `{ dispatched: false, reason: "HTTP_4xx" }` |
| Circuit breaker OPEN | No call made | Returns `{ dispatched: false, reason: "AI_BACKEND_UNAVAILABLE" }` immediately |
| `NEXT_PUBLIC_AI_API_URL` not set | No call made | Returns `{ dispatched: false, reason: "AI_API_URL_NOT_CONFIGURED" }` |

### User impact
- The upload response still succeeds — the user is redirected to the
  processing page.
- The job remains in **`queued`** status. When the AI backend recovers, the
  job can be re-dispatched via `POST /api/jobs/{id}` (retry button on the
  processing page, or via the API directly).
- The processing page shows the job as "queued" rather than progressing.

### No additional env vars required for fallback behavior.

---

## 2. Virus Scanning (`app/lib/virusScan.ts`)

### What it does
Scans every uploaded file buffer before it leaves the quarantine prefix.
Supports ClamAV, VirusTotal, and Cloudmersive providers.

### Failure modes and fallbacks

| Failure | Default behavior | Degraded behavior (`VIRUS_SCAN_ALLOW_ON_FAILURE=true`) |
|---------|-----------------|-------------------------------------------------------|
| Provider timeout | Upload rejected with `"File failed security scan"` | Upload proceeds; job flagged with `scanDegraded: true` |
| Provider network error | Upload rejected | Upload proceeds with degraded flag |
| Circuit breaker OPEN | Upload rejected immediately | Upload proceeds with degraded flag |
| `CONFIG_ERROR` (bad provider env var) | Upload always rejected | Upload always rejected (config errors are never bypassed) |

### Controlling the fallback

```bash
# Allow uploads when the scan service is unavailable (degraded mode).
# Only set this when an alternative security control exists (e.g.
# post-processing re-scan by the AI backend).
VIRUS_SCAN_ALLOW_ON_FAILURE=true
```

When `VIRUS_SCAN_ALLOW_ON_FAILURE=true`:
- The returned `ScanResult` includes `degraded: true` and a `degradedReason`
  string.
- `processUploadedBuffer` sets `scanDegraded: true` and `scanDegradedReason`
  on the `ProcessedUpload` result.
- The upload route should persist this flag on the job record for auditing.

### User impact (default — ALLOW_ON_FAILURE not set)
- Upload is rejected with HTTP 400 and error code `SECURITY_SCAN_FAILED`.
- The user sees: _"File failed security scan"_.

### User impact (ALLOW_ON_FAILURE=true)
- Upload proceeds normally.
- A warning may be surfaced to operators via logs (logged at `WARN` level).
- No user-visible warning is shown by default.

---

## 3. Cloud Storage — S3/R2/GCS (`app/lib/cloudStorage.ts`)

### What it does
All file operations (upload, quarantine, move, delete) go through the AWS S3
SDK against an S3-compatible backend.

### Failure modes and fallbacks

| Operation | Retries | Circuit breaker OPEN behavior |
|-----------|---------|-------------------------------|
| Single-part upload | 3 attempts, 300 ms–5 s backoff | `CircuitOpenError` thrown → upload fails with 503 |
| Multipart part upload | 3 attempts per part | `CircuitOpenError` thrown → multipart aborted, upload fails |
| Copy (quarantine → final) | 3 attempts | `CircuitOpenError` thrown → upload fails |
| Delete (quarantine cleanup) | 3 attempts | Logs error with orphaned key; does **not** throw |

Non-retryable errors (credential failures, bucket-not-found, 403/404) skip
the retry loop and go straight to circuit-breaker failure recording.

### User impact
- When the circuit is OPEN, uploads return HTTP 503:
  _"Cloud storage is not configured. Contact support."_  
  (The existing error handler in the upload route already covers 503.)
- Orphaned quarantine keys (when delete fails while circuit is open) are
  logged at `ERROR` level with the full object key for manual cleanup.

### No additional env vars required for fallback behavior.

---

## 4. Redis / Job Store (`app/api/jobs/shared/jobStore.ts`)

### What it does
Stores job state (progress, status, error). Redis when `REDIS_URL` is set,
in-memory otherwise.

### Failure modes and fallbacks

| Failure | Fallback |
|---------|----------|
| `REDIS_URL` not set | In-memory adapter used automatically (single-instance only) |
| Redis unreachable at startup | Falls back to in-memory, logs a startup warning |
| Redis read failure during SSE stream | Error counter incremented; after 5 consecutive failures the stream sends `STORE_UNAVAILABLE` error event and closes |

### SSE stream behavior on Redis failure
1. The client receives `{ status: "error", errorCode: "STORE_UNAVAILABLE" }`.
2. `useProcessingStatus` detects the SSE error, exhausts its reconnect
   attempts, and falls back to HTTP polling at `/api/jobs/{id}` every 3 s.
3. If polling also fails (Redis still down), the error is logged client-side
   but the UI remains on the last known state.

### User impact
- If Redis goes down mid-processing, the progress bar may stop updating
  briefly, then recover once Redis comes back.
- In the worst case the user sees the processing page stuck on the last
  known progress value. The page is still interactive and the retry/cancel
  buttons work.

---

## 5. In-App Degraded Mode Indicator

When any circuit breaker is in `OPEN` or `HALF_OPEN` state, an amber banner
appears at the top of every dashboard page (`DegradedModeBanner`).

The banner:
- Lists each affected service by name with a plain-English fallback
  description.
- Shows a `Recovering` badge for `HALF_OPEN` and `Unavailable` for `OPEN`.
- Can be expanded to show per-service details.
- Can be dismissed for the current session.
- Has a "Refresh status" button that triggers an immediate re-poll of
  `/api/health/circuit-breakers` without a full page reload.
- Automatically re-appears if a new service degrades after dismissal
  (state is not persisted across reloads).

The banner is driven by the `useServiceHealth` hook, which polls
`/api/health/circuit-breakers` every **30 seconds** and resumes polling
when the browser tab becomes visible again after being backgrounded.

---

## 6. Readiness Endpoint (`/api/health/ready`)

The existing readiness probe independently checks Redis, AI backend, and S3
by making live network calls. It returns:

- `200 { status: "ok" }` — all dependencies healthy
- `200 { status: "degraded" }` — some dependencies degraded but service can
  handle traffic
- `503 { status: "down" }` — a critical dependency is unreachable

This endpoint is independent of the circuit breakers — it probes the services
directly and is intended for load-balancer / k8s readiness checks.

---

## 7. Environment Variable Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_AI_API_URL` | — | AI backend base URL. Jobs stay queued when unset |
| `AI_BACKEND_SECRET` | — | Bearer token for outbound AI requests |
| `VIRUS_SCAN_PROVIDER` | `clamav` | `clamav` \| `virustotal` \| `cloudmersive` \| `disabled` |
| `VIRUS_SCAN_ENABLED` | `true` in prod | Set `false` to skip scanning entirely |
| `VIRUS_SCAN_ALLOW_ON_FAILURE` | unset (false) | `true` to allow uploads when scanner is down |
| `VIRUS_SCAN_TIMEOUT` | `30000` | Scan timeout in ms |
| `CLAMAV_API_URL` | — | ClamAV HTTP API endpoint |
| `VIRUSTOTAL_API_KEY` | — | VirusTotal API key |
| `CLOUDMERSIVE_API_KEY` | — | Cloudmersive API key |
| `REDIS_URL` | — | Redis connection string. In-memory fallback used when absent |
| `CLOUD_STORAGE_BUCKET` | — | S3 bucket name |
| `CLOUD_STORAGE_REGION` | `us-east-1` | S3 region |
| `CLOUD_STORAGE_ENDPOINT` | — | Custom endpoint for R2/GCS |
| `AWS_ACCESS_KEY_ID` | — | S3 credentials |
| `AWS_SECRET_ACCESS_KEY` | — | S3 credentials |

---

## 8. Runbook: Recovering from a Degraded State

### AI backend is down
1. Check `/api/health/circuit-breakers` — confirm `aiBackend` state is `OPEN`.
2. Check AI backend logs / status page.
3. Once the backend is healthy again, the circuit will automatically
   transition to `HALF_OPEN` after 60 s and close on the first successful
   dispatch.
4. Jobs stuck in `queued` can be re-dispatched individually via
   `POST /api/jobs/{id}` or in bulk via a one-off script that calls that
   endpoint for every job with `status === "queued"`.

### Virus scanner is down
1. Check `/api/health/circuit-breakers` — confirm `virusScan` state is `OPEN`.
2. If uploads must continue during the outage, set
   `VIRUS_SCAN_ALLOW_ON_FAILURE=true` and redeploy (or set via runtime env
   if your platform supports it).
3. Once the scanner recovers, the circuit resets after 120 s. Remove
   `VIRUS_SCAN_ALLOW_ON_FAILURE` and redeploy to restore strict scanning.
4. Review `scanDegraded: true` jobs and re-scan them if needed.

### S3 / cloud storage is down
1. Check `/api/health/circuit-breakers` — confirm `cloudStorage` state is `OPEN`.
2. Uploads are blocked while storage is down — no workaround is available
   (files must be stored somewhere).
3. Check for orphaned quarantine keys logged at `ERROR` level and clean them
   up after storage recovers.
4. The circuit resets after 30 s once S3 starts responding.

### Redis is down
1. The job store automatically falls back to in-memory storage within the
   same worker process. State is not shared across workers.
2. SSE streams close after 5 consecutive read failures; clients fall back
   to HTTP polling automatically.
3. Once Redis recovers, new requests use Redis again automatically (the
   adapter is selected at startup, so a process restart may be needed in
   some deployment configurations).
