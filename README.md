  # ClipCash UI

Next.js 15 frontend for ClipCash — an AI-powered video clipping platform.

---

## Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State / Data**: TanStack Query v5
- **HTTP**: Axios (via `lib/apiClient.ts`)
- **Auth**: HTTP-only JWT cookies (set by backend)
- **Wallet**: Stellar Wallets Kit v2 (`@creit-tech/stellar-wallets-kit`)
- **Testing**: Vitest + Playwright

---

## Environment Variables

Create `.env.local` in the project root:

```bash
# Server-only — never sent to the browser
API_URL=https://clipcash-api.onrender.com

# Client-side — points to the Next.js proxy route
NEXT_PUBLIC_API_URL=/api/proxy

# Stellar network: leave empty for testnet, set to "mainnet" for production
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

> Never set `NEXT_PUBLIC_*` to the real backend URL. The proxy in `app/api/proxy/[...path]/route.ts` keeps it server-side only.

---

## Getting Started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run test       # unit tests (vitest)
npm run test:e2e   # e2e tests (playwright)
```

---

## Architecture

### Proxy Route
All API calls go through `app/api/proxy/[...path]/route.ts`. This:
- Keeps the real backend URL out of the browser bundle
- Forwards auth cookies automatically
- Handles SSE streaming for real-time progress
- Returns `503` instead of crashing when the backend is waking up (Render free tier)

### Auth Flow
```
Login  → POST /auths/login  → GET /users/me → /dashboard
Signup → POST /auths/signup → GET /users/me → /onboarding → /dashboard
Google → /api/proxy/auths/google (redirects via backend OAuth)
Wallet → connect wallet → /onboarding?wallet=<address> → signup form
```

Session is maintained via HTTP-only cookies. `AuthProvider` protects all routes under `/dashboard`, `/projects`, `/clips`, `/platforms`, `/settings`.

### Video Upload Flow
```
Select file → click "Generate Clips"
  → POST /api/proxy/videos (multipart)
  → 201 { id: videoId }
  → /dashboard/processing?videoId=<id>
  → SSE: GET /api/proxy/events/processing-progress/<id>
  → progress bar updates live
  → status: "done" → /projects?videoId=<id>
  → clips appear in grid with preview + download
```

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with URL import form |
| `/login` | Login / signup |
| `/onboarding` | New user profile setup (2 steps) |
| `/dashboard` | Stats + recent projects |
| `/clips` | Upload video or paste URL |
| `/projects` | Generated clips grid with preview |
| `/platforms` | Connect social accounts + Stellar wallet |
| `/settings` | Password change, account deletion |
| `/dashboard/processing` | Live AI processing progress (SSE) |

---

## What's Working

- ✅ Email signup / login
- ✅ Google OAuth (via backend redirect)
- ✅ Stellar wallet connect (Freighter, Lobstr, Albedo, Rabet)
- ✅ New user onboarding (username + niche → social connect)
- ✅ Returning users go straight to dashboard (no onboarding loop)
- ✅ Video upload via file (multipart through proxy)
- ✅ YouTube/TikTok/Vimeo URL import
- ✅ Live AI processing progress via SSE
- ✅ Clip grid with preview modal (video player), download, delete
- ✅ Batch post clips to TikTok
- ✅ Batch delete clips (with confirmation)
- ✅ Social platform connect via OAuth (TikTok, Instagram, YouTube, X)
- ✅ Stellar wallet display in Platforms page
- ✅ Password change + account deletion in Settings
- ✅ Proxy handles ECONNRESET gracefully (returns 503 with friendly message)

---

## What the Backend Still Needs

These items are blocked on backend changes:

| Feature | What's needed |
|---------|---------------|
| Reliable onboarding routing | `GET /users/me` should return `onboardingStep` (number) or `username`. Currently returns only `{ id, email, fullName, picture }` |
| Wallet auth | `POST /auths/wallet { stellarAddress }` endpoint for wallet-only login |
| Social posting platform selection | `POST /platforms/post-clip` currently hardcoded to `["tiktok"]` — needs UI to select platforms once backend is confirmed |
| Platform OAuth (500 error) | `GET /platforms/connect/:platform` returns 500 — check WoopSocial API credentials in Render environment variables |
| Video upload + AI processing (500 error) | `POST /videos` returns 500 after upload — check Cloudinary credentials and ffmpeg availability on the Render instance |

---

## Known Limitations

- **Render free tier cold starts**: The backend sleeps after 15 min of inactivity. First request returns `ECONNRESET` / 503. The proxy handles this gracefully — just retry after ~30 seconds.
- **`ClipsStats` component** (`components/clips/ClipsStats.tsx`) shows static marketing copy ("98% accuracy"). These should be replaced with real analytics once the backend exposes them.
- **`RevenueChart`** (`components/dashboard/RevenueChart.tsx`) uses hardcoded chart points. Replace with real earnings data when available.
- **`PlatformDistribution`** (`components/dashboard/PlatformDistribution.tsx`) shows hardcoded percentages. Wire to real posting stats when available.
- **`AIInsightCard`** (`components/dashboard/AIInsightCard.tsx`) shows a static insight string. Wire to a real AI recommendation endpoint when available.
- **Edit clip** button in `ClipCard` is a placeholder — the edit flow (trim points, captions, audio overlay) is not yet implemented.

---

## Security Notes

- Backend URL never appears in the browser bundle (`API_URL` is server-only)
- Google OAuth redirect goes through `/api/proxy/auths/google` (not directly to the backend)
- Auth cookies are HTTP-only — not readable by JavaScript
- File upload validates MIME type client-side; backend enforces the 2GB limit
- `window.confirm()` is removed from delete flows — replaced with inline confirmation UI
- `alert()` is removed from all flows — replaced with in-app toast notifications
- Stellar wallet address is stored in `WalletProvider` state only (removed from `localStorage`)
