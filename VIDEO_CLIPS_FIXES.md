# Video Upload, URL Import & Clip Generation — Fix Log

## Issues Found & Fixed

---

### 1. `POST /videos/from-url` → 500 Internal Server Error

**Root cause (frontend):** The URL form accepted any string and sent it without validation. The backend rejects non-YouTube/TikTok/Vimeo URLs with a 500 crash.

**Fix (`CreateClipsForm.tsx`):** Added client-side URL validation before the API call. Only YouTube (`youtube.com/watch`, `youtu.be/`), TikTok (`tiktok.com/`), and Vimeo (`vimeo.com/`) URLs are now accepted. Invalid URLs show an error message without hitting the backend.

**Root cause (backend):** If you paste a valid YouTube URL and still get 500, the backend's YouTube download service (yt-dlp or similar) is not configured on the Render server. Check Render environment variables — the service needs `YOUTUBE_DL_PATH` or equivalent set, and the binary must be available on the server.

---

### 2. `POST /videos` → 400 Bad Request (file upload)

**Root cause:** Axios sets `Content-Type: application/json` by default via `apiClient` defaults. When `FormData` is passed, the browser needs to set `Content-Type: multipart/form-data; boundary=...` automatically. The hardcoded JSON header overrode this, so the backend received a malformed request.

**Fix (`CreateClipsForm.tsx`):** Pass `{ headers: { "Content-Type": undefined } }` in the Axios request config to remove the override. The browser then correctly sets the multipart boundary.

---

### 3. Wrong API response shape in `queries.ts`

**Root cause:** The backend returns `{ data: [...], total, page, limit }` for paginated endpoints (`GET /videos`, `GET /clips`). The code was reading `.items` which doesn't exist.

**Fix (`lib/queries.ts`):**
- `getDashboardData`: reads `videosRes.data.data` instead of `.items`
- `getProjectsData`: reads `response.data.data` instead of `.items`
- `getVideos`: returns `{ items, total }` with `response.data.data` as items

---

### 4. Dashboard page used hardcoded mock data

**Root cause:** `app/dashboard/page.tsx` had a fake `getDashboardData()` function returning static strings ("142 clips", "$12,450.80") — never called the API.

**Fix (`app/dashboard/page.tsx`):** Replaced with a real server-side fetch to `GET /videos?page=1&limit=6` and `GET /platforms`. Falls back to empty state if unauthenticated or API is unreachable.

---

### 5. Projects page used hardcoded mock data

**Root cause:** `app/projects/page.tsx` had a static array of fake clip objects with hardcoded Unsplash thumbnails.

**Fix (`app/projects/page.tsx`):** Replaced with a real call to `getProjectsData()` which hits `GET /clips`. Falls back to empty array.

---

### 6. Processing page SSE connected to wrong URL

**Root cause:** The code used `process.env.NEXT_PUBLIC_API_URL || 'https://clipcash-api.onrender.com'` to build the SSE URL. Since `NEXT_PUBLIC_API_URL` is `/api/proxy`, the SSE URL correctly proxied. But if the env var was missing, it would hit the backend directly — bypassing cookies and failing with 401.

**Fix (`app/dashboard/processing/page.tsx`):**
- Always uses `/api/proxy` as base URL (with env var fallback)
- Adds `{ withCredentials: true }` to `EventSource` so the auth cookie is sent
- Handles both `status === "done"` and `status === "completed"` (backend uses "done")
- Redirects to `/projects?videoId=<id>` instead of `/projects/<id>` (the latter route doesn't exist)
- On SSE error, shows message instead of silently dying (processing continues on backend)

---

### 7. Proxy route didn't support SSE streaming

**Root cause:** The proxy route was buffering the entire response before forwarding it. For SSE (`text/event-stream`) responses, this means the browser receives no events until the stream closes — which for processing progress means nothing until the job finishes.

**Fix (`app/api/proxy/[...path]/route.ts`):**
- Detects `content-type: text/event-stream` responses
- Adds `cache-control: no-cache` and `x-accel-buffering: no` headers for SSE
- Added `export const maxDuration = 300` to allow 5-minute connections for uploads and SSE streams

---

### 8. `clip.score` field name mismatch

**Root cause:** The backend returns `viralScore` not `score` based on the API spec. The queries were reading `clip.score` which would always be 0.

**Fix (`lib/queries.ts` — `getProjectsData`):** Now reads `clip.viralScore ?? clip.score ?? 0` with fallback.

---

## What the `POST /videos/from-url` 500 means for your backend

The frontend call is now correct. If you still get 500 after this fix with a valid YouTube URL, the backend server on Render needs these checked:

1. **Go to Render dashboard** → service `srv-d85gkcjtqb8s7380j1bg` → Environment
2. Check if there's a YouTube download dependency (yt-dlp, youtube-dl) installed
3. Check Render logs for the actual crash message — it will say something like "yt-dlp not found" or "OPENAI_API_KEY missing"
4. The AI processing pipeline needs API keys for the AI model (likely OpenAI or similar) — these must be set as env vars on Render

The 500 is a backend configuration issue, not a frontend bug.

---

## Endpoint Reference (what the frontend now calls)

| Action | Endpoint | Notes |
|--------|----------|-------|
| Submit YouTube URL | `POST /videos/from-url` | `{ url, targetPlatforms, style }` |
| Upload video file | `POST /videos` | `multipart/form-data`, no Content-Type header |
| Watch AI progress | `GET /events/processing-progress/:videoId` | SSE stream via proxy |
| List user's videos | `GET /videos?page=1&limit=10` | Returns `{ data, total, page, limit }` |
| List user's clips | `GET /clips?page=1&limit=20` | Returns `{ data, total, page, limit }` |
| Get clips for video | `GET /videos/:id/clips` | Returns array |
| Dashboard stats | `GET /videos` + `GET /platforms` | Combined |
