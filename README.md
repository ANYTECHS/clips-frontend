# ClipCash

ClipCash is an AI-powered platform that turns long-form videos into short, platform-ready clips for TikTok, Instagram Reels, YouTube Shorts, and more. Creators preview and select every clip before posting, with optional NFT minting on the Stellar network for true content ownership and on-chain royalties.

## Architecture

```mermaid
graph LR
    Browser["Browser\n(Next.js 16 / React 19)"]
    API["Next.js API Routes\n(/api/upload, /api/jobs, /api/auth)"]
    AI["AI Backend\n(video processing service)"]
    S3["S3-compatible Storage\n(AWS S3 / R2 / GCS)"]
    Stellar["Stellar Network\n(Soroban smart contracts)"]
    Redis["Redis\n(job state — production)"]

    Browser -->|"multipart upload (XHR)"| API
    API -->|"quarantine → virus scan → move"| S3
    API -->|"POST /jobs (Bearer)"| AI
    AI -->|"POST /api/jobs/[id]/callback"| API
    API -->|"SSE stream / polling fallback"| Browser
    API <-->|"job state"| Redis
    Browser -->|"mint / sign tx"| Stellar
```

### System Overview

ClipCash is a single Next.js application that serves both the React UI and the API routes, backed by an external AI video-processing service, S3-compatible object storage, and the Stellar network for on-chain ownership.

| Layer | Responsibility |
|---|---|
| **Frontend** | Next.js App Router pages, React 19 components, Zustand stores for client state |
| **API Routes** | Auth (NextAuth), upload handling, job orchestration, AI callbacks, SSE streaming |
| **AI Backend** | External service that transcribes, segments, and renders clips |
| **Storage** | S3-compatible bucket holding source videos and rendered clips |
| **Job State** | Redis in production; in-memory fallback for local development |
| **Blockchain** | Soroban smart contracts on Stellar for NFT minting and royalties |

### Data Flow

1. **Upload** — the browser streams the source video to `/api/upload` via XHR. The API writes it to a quarantine prefix, runs the configured virus scan, then moves the object to its final key.
2. **Dispatch** — the API creates a job record and `POST`s it to the AI backend with a Bearer token.
3. **Processing** — the AI backend transcribes and segments the video, then calls back to `/api/jobs/[id]/callback` with the generated clips.
4. **Delivery** — the browser receives progress over an SSE stream, falling back to polling when SSE is unavailable.
5. **Minting** — when a creator mints a clip, the browser signs a transaction that the Soroban contract records on Stellar.

### Key Design Decisions

- **Single Next.js app for UI + API** — keeps deployment simple and lets API routes share types and utilities with the frontend. Trade-off: heavier serverless functions and no independent scaling of the API tier.
- **External AI backend** — video processing is CPU/GPU intensive and long-running, so it lives outside the request/response cycle. Trade-off: an extra network hop and a callback contract to maintain.
- **Quarantine-then-scan uploads** — files are staged and scanned before becoming visible, so untrusted content never reaches the serving path. Trade-off: extra storage writes and latency per upload.
- **Redis for job state** — job state must be shared across instances in production; an in-memory store keeps local development dependency-free. Trade-off: two code paths to keep in sync.
- **Stellar/Soroban for ownership** — low fees and fast finality make on-chain minting practical for individual creators. Trade-off: wallet UX and network-specific contract IDs.

### Technology Choices

- **Next.js 16 / React 19** — App Router, server components, and built-in API routes in one framework.
- **Zustand** — lightweight client state without the boilerplate of a larger store library.
- **S3-compatible storage** — portable across AWS S3, Cloudflare R2, and GCS via the S3 interop API.
- **Redis** — simple, fast shared state for job tracking across instances.
- **Stellar / Soroban** — low-cost smart contracts for NFT ownership and royalties.

For a deep dive into each system — upload quarantine, AES-GCM wallet encryption, JWT session shape, Zustand store layout — see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

For the current security posture, threat model, and reporting process, see **[docs/SECURITY.md](docs/SECURITY.md)**.

For the full HTTP API reference — every endpoint, request/response examples, authentication, and error shapes — see **[docs/API.md](docs/API.md)**. A machine-readable OpenAPI 3.1 spec is available at **[docs/openapi.yaml](docs/openapi.yaml)**.

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/ANYTECHS/clips-frontend.git
cd clips-frontend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local — the minimum required variables are listed below

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs fully offline with in-memory job storage and virus scanning disabled in development.

---

## API Documentation

The HTTP API is documented in **[docs/API.md](docs/API.md)** and described by an OpenAPI 3.1 spec at **[docs/openapi.yaml](docs/openapi.yaml)**.

### Authentication

Most endpoints require an authenticated session. Callers authenticate in one of two ways:

- **Browser session cookie** — set by NextAuth after an OAuth sign-in (`/api/auth/*`). Sent automatically by the browser.
- **Bearer token** — send `Authorization: Bearer <token>` for server-to-server calls (e.g. the AI backend calling back into the app).

Endpoints that are called by the AI backend additionally require the shared secret header `x-callback-secret: <AI_BACKEND_CALLBACK_SECRET>`.

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/upload` | Session | Upload a source video (multipart). Returns a job id. |
| `GET` | `/api/jobs` | Session | List the caller's jobs. |
| `GET` | `/api/jobs/[id]` | Session | Fetch a single job's status and metadata. |
| `GET` | `/api/jobs/[id]/stream` | Session | SSE stream of job progress (polling fallback available). |
| `POST` | `/api/jobs/[id]/callback` | Callback secret | AI backend reports job completion/failure. |
| `GET` | `/api/auth/session` | Public | Current session (NextAuth). |
| `POST` | `/api/auth/signin` | Public | Begin OAuth sign-in. |
| `POST` | `/api/auth/signout` | Session | End the current session. |

### Example: upload a video

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Cookie: next-auth.session-token=<token>" \
  -F "file=@clip.mp4"
```

```json
{ "jobId": "job_01H...", "status": "queued" }
```

### Example: fetch a job

```bash
curl http://localhost:3000/api/jobs/job_01H... \
  -H "Cookie: next-auth.session-token=<token>"
```

```json
{
  "id": "job_01H...",
  "status": "completed",
  "clips": [{ "id": "clip_1", "url": "https://.../clip_1.mp4" }]
}
```

### Error responses

All errors share a consistent JSON shape:

```json
{ "error": "Unauthorized", "message": "Authentication required" }
```

| Status | Meaning |
|---|---|
| `400` | Malformed request (missing/invalid fields) |
| `401` | Missing or invalid authentication |
| `403` | Authenticated but not permitted (e.g. bad callback secret) |
| `404` | Resource not found |
| `413` | Upload exceeds the size limit |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values. The most common variables are summarised below. The **complete reference**, with required/optional status, defaults, examples and security notes, is in **[docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)**.

For the production release procedure, environment setup, deployment checklists, monitoring, and rollback steps, see the **[Deployment Runbook](docs/DEPLOYMENT_RUNBOOK.md)**.

### Auth

| Variable | Required | Default | Description | Example |
|---|---|---|---|---|
| `NEXTAUTH_SECRET` | **Yes** | — | Session signing key. Never commit this value; rotate it to invalidate all sessions. | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | **Yes** | — | Canonical app URL used to build OAuth callbacks. Must match the deployed origin. | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | **Yes** | — | Google OAuth client ID. | `1234567890-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | **Yes** | — | Google OAuth client secret. Keep server-side only. | `GOCSPX-xxxxxxxxxxxxxxxx` |
| `APPLE_ID` | Optional | — | Apple Sign-In service ID. | `com.clipcash.web` |
| `APPLE_TEAM_ID` | Optional | — | Apple developer team ID. | `ABCDE12345` |
| `APPLE_KEY_ID` | Optional | — | Apple Sign-In key ID. | `XYZ9876543` |
| `APPLE_PRIVATE_KEY` | Optional | — | Apple Sign-In private key (full PEM). Store as a secret; never expose to the client. | `-----BEGIN PRIVATE KEY-----\n...` |
| `TWITTER_CLIENT_ID` | Optional | — | Twitter OAuth 2.0 client ID. | `abc123` |
| `TWITTER_CLIENT_SECRET` | Optional | — | Twitter OAuth 2.0 client secret. | `def456` |
| `INSTAGRAM_CLIENT_ID` | Optional | — | Instagram OAuth client ID. | `1234567890` |
| `INSTAGRAM_CLIENT_SECRET` | Optional | — | Instagram OAuth client secret. | `abcdef123456` |
| `TIKTOK_CLIENT_KEY` | Optional | — | TikTok OAuth client key. | `aw1234567890` |
| `TIKTOK_CLIENT_SECRET` | Optional | — | TikTok OAuth client secret. | `abcdef123456` |

### AI Backend

| Variable | Required | Default | Description | Example |
|---|---|---|---|---|
| `NEXT_PUBLIC_AI_API_URL` | Prod only | — | Base URL of the AI video processing service. If unset in dev, jobs stay `queued` — no crash. | `https://ai.example.com` |
| `AI_BACKEND_SECRET` | Prod only | — | Bearer token sent on outbound dispatches to the AI service. Server-side only. | `openssl rand -hex 32` |
| `AI_BACKEND_CALLBACK_SECRET` | **Yes (prod)** | — | Secret the AI service must send when calling `/api/jobs/[id]/callback`. Generate: `openssl rand -hex 32`. | `openssl rand -hex 32` |
| `NEXT_PUBLIC_API_URL` | Optional | `http://localhost:4000` | Base URL for the main backend API (user profile, earnings). | `https://api.example.com` |

### Cloud Storage

Files require a valid S3-compatible bucket to upload. In development you can leave these blank — uploads will fail but the rest of the app works.

| Variable | Required | Default | Description | Example |
|---|---|---|---|---|
| `CLOUD_STORAGE_BUCKET` | **Yes (prod)** | — | Bucket name. | `clipcash-uploads` |
| `CLOUD_STORAGE_REGION` | **Yes (prod)** | — | Region, e.g. `us-east-1`. Use `auto` for Cloudflare R2. | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | **Yes (prod)** | — | Access key / account ID. Grant least-privilege bucket access only. | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | **Yes (prod)** | — | Secret key / API token. Never commit or expose to the client. | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `CLOUD_STORAGE_PROVIDER` | Optional | `s3` | Storage backend: `s3` \| `r2` \| `gcs`. | `r2` |
| `CLOUD_STORAGE_ENDPOINT` | Optional | — | Custom endpoint for R2/GCS S3 interop. Leave blank for AWS S3. | `https://<account>.r2.cloudflarestorage.com` |
| `CLOUD_STORAGE_KEY_PREFIX` | Optional | `uploads/` | Object key prefix for stored files. | `uploads/` |

### Redis

| Variable | Required | Default | Description | Example |
|---|---|---|---|---|
| `REDIS_URL` | **Yes (prod)** | — | Redis connection string. Without this, job state lives in-process — fine for dev, broken on multi-instance deployments. Use TLS (`rediss://`) and a password in production. | `redis://:password@hostname:6379` |

### Stellar / Blockchain

| Variable | Required | Default | Description | Example |
|---|---|---|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | Optional | `testnet` | Target network: `testnet` \| `mainnet`. | `testnet` |
| `NEXT_PUBLIC_STELLAR_RPC` | Optional | — | Custom Soroban RPC URL override. | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_STELLAR_NFT_CONTRACT_ID` | Optional | — | Soroban NFT contract address (testnet). | `C...` |
| `NEXT_PUBLIC_STELLAR_NFT_CONTRACT_ID_MAINNET` | Optional | — | Soroban NFT contract address (mainnet). | `C...` |

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for onboarding, local setup, contribution guidelines, the code review process, good first issues and where to ask questions. Browse the component library with `npm run storybook`; see [STORYBOOK.md](STORYBOOK.md) for how it is deployed.

/* … truncated 5008 chars — edit only what you need near the top … */
