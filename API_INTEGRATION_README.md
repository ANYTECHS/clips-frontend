# ClipCash API Integration Guide

> **Backend base URL:** `https://clipcash-api.onrender.com`  
> **Swagger docs:** `https://clipcash-api.onrender.com/api/docs`  
> **Service ID:** `srv-d85gkcjtqb8s7380j1bg`

---

## Overview

This guide walks through replacing every `MockApi` call and hardcoded mock dataset in this Next.js frontend with real calls to the ClipCash backend. The backend uses **HTTP-only JWT cookies** for auth — no `Authorization` header needed. Once the user logs in, the browser sends the cookie automatically on every request.

The integration touches six areas in order:

1. Auth (signup / login / logout / Google OAuth / token refresh)
2. User profile (read + update + password change)
3. Video upload & URL submission
4. Real-time progress via Server-Sent Events (SSE)
5. Clips management
6. Social platform connections & posting

---

## Environment Variables — `.env.local`

Create a `.env.local` file at the **root of the project** (next to `package.json`). It is already in `.gitignore` so it will never be committed.

```bash
# ─────────────────────────────────────────────
# ClipCash Frontend — .env.local
# Copy this block, fill in the values, save as .env.local
# ─────────────────────────────────────────────

# ── Backend API ──────────────────────────────
# The base URL of the ClipCash backend. No trailing slash.
NEXT_PUBLIC_API_URL=https://clipcash-api.onrender.com

# ── App URL ──────────────────────────────────
# The URL this frontend is running on.
# Used by the backend to redirect after Google OAuth and WoopSocial OAuth.
# Change to http://localhost:3000 for local development.
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── Google OAuth ─────────────────────────────
# Not needed on the frontend — Google OAuth is handled entirely by the backend.
# The button in AuthForm.tsx already redirects to:
#   https://clipcash-api.onrender.com/auths/google
# No client-side Google credentials are required.

# ── WoopSocial (Platform OAuth) ──────────────
# Not needed on the frontend — the backend generates the OAuth URLs.
# Your frontend only calls GET /platforms/connect/:platform and receives a URL.
# No WoopSocial keys are needed here.
```

### What each variable does

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | **Yes** | Base URL for all `apiRequest()` calls. Prefixed with `NEXT_PUBLIC_` so it is available in browser-side code. |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Your frontend's own URL. The backend needs this to redirect back after OAuth flows complete. Set to `http://localhost:3000` locally and your production domain when deployed. |

### Rules for `.env.local` in Next.js

- Variables prefixed with `NEXT_PUBLIC_` are **exposed to the browser**. Only put non-secret values here (URLs are fine).
- Variables **without** `NEXT_PUBLIC_` are server-only and never sent to the browser. There are none needed for this project right now since auth is cookie-based.
- `.env.local` is loaded automatically by Next.js — no extra setup needed.
- After editing `.env.local`, **restart the dev server** (`npm run dev`) for changes to take effect.

### Local vs Production values

| Variable | Local dev | Production |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://clipcash-api.onrender.com` | `https://clipcash-api.onrender.com` (same — backend is already deployed) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://your-production-domain.com` |

### `next.config.ts` update needed

The backend returns Cloudinary image URLs for video thumbnails and clip thumbnails. Add Cloudinary to the `remotePatterns` in `next.config.ts` so `next/image` can load them:

```ts
// next.config.ts
remotePatterns: [
  {
    protocol: 'https',
    hostname: 'api.dicebear.com',
  },
  {
    protocol: 'https',
    hostname: 'images.unsplash.com',
  },
  // Add this — backend stores thumbnails on Cloudinary
  {
    protocol: 'https',
    hostname: 'res.cloudinary.com',
  },
],
```

---

## Prerequisites

### 1. Create a central API client

Create `lib/apiClient.ts`. Every fetch in this project should go through this file.

```ts
// lib/apiClient.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://clipcash-api.onrender.com";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include", // sends the HTTP-only cookie automatically
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
```

### 2. Add the env variable

Add to `.env.local`:

```
NEXT_PUBLIC_API_URL=https://clipcash-api.onrender.com
```

---

## Step 1 — Authentication

### How it works

The backend sets two HTTP-only cookies on successful login/signup:
- `access_token` — short-lived JWT
- `refresh_token` — used to get a new access token

You never read these cookies in JS. The browser sends them automatically on every `credentials: "include"` request.

### 1.1 Signup

**Endpoint:** `POST /auths/signup`

**Request body:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:** `201` — cookies are set, no body needed beyond success confirmation.

**What to change in the codebase:**

Replace `MockApi.signup(email, password, fullName)` in `components/AuthForm.tsx`:

```ts
// Before (mock)
const res = await MockApi.signup(email, password, fullName);

// After (real API)
await apiRequest("/auths/signup", {
  method: "POST",
  body: JSON.stringify({ fullName, email, password }),
});
// Then immediately fetch the user profile
const user = await apiRequest<User>("/users/me");
```

### 1.2 Login

**Endpoint:** `POST /auths/login`

**Request body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:** `200` — cookies are set.

**What to change:**

Replace `MockApi.login(email, password)` in `components/AuthForm.tsx`:

```ts
// After (real API)
await apiRequest("/auths/login", {
  method: "POST",
  body: JSON.stringify({ email, password }),
});
const user = await apiRequest<User>("/users/me");
```

### 1.3 Google OAuth

The Google OAuth button in `components/AuthForm.tsx` already points to the correct URL:

```ts
// This is already correct — keep it as-is
window.location.href = "https://clipcash-api.onrender.com/auths/google";
```

After Google redirects back, the backend sets cookies and redirects to `/dashboard`. The `AuthProvider` will pick up the session on the next `GET /users/me` call.

**UI update needed:** After the Google redirect lands on `/dashboard`, `AuthProvider` needs to call `GET /users/me` to hydrate the user state. See Step 2.1.

### 1.4 Logout

**Endpoint:** `POST /auths/logout`

**What to change in `components/AuthProvider.tsx`:**

```ts
const logout = async () => {
  await apiRequest("/auths/logout", { method: "POST" });
  setUser(null);
  Cookies.remove("clipcash_user"); // remove the local mirror
  router.push("/login");
};
```

### 1.5 Token Refresh

**Endpoint:** `POST /auths/refresh`

Call this automatically when any request returns `401`. Add an interceptor in `lib/apiClient.ts`:

```ts
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  // Auto-refresh on 401
  if (res.status === 401 && path !== "/auths/refresh") {
    const refreshed = await fetch(`${BASE_URL}/auths/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshed.ok) {
      // Retry original request
      res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...options.headers },
      });
    } else {
      // Refresh failed — redirect to login
      window.location.href = "/login";
      throw new ApiError(401, "Session expired");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
```

---

## Step 2 — User Profile

### 2.1 Get current user (replaces cookie-based session restore)

**Endpoint:** `GET /users/me`

**Response example:**
```json
{
  "id": "abc123",
  "email": "john@example.com",
  "fullName": "John Doe",
  "username": "johndoe",
  "picture": "https://...",
  "onboardingStep": 1
}
```

**What to change in `components/AuthProvider.tsx`:**

Replace the cookie-based restore with a real API call:

```ts
useEffect(() => {
  const restoreSession = async () => {
    try {
      const user = await apiRequest<User>("/users/me");
      setUserState(user);
    } catch {
      // 401 = not logged in, that's fine
    } finally {
      setIsLoading(false);
    }
  };
  restoreSession();
}, []);
```

Remove the `Cookies.get("clipcash_user")` restore logic — the backend cookie is the source of truth now.

### 2.2 Update profile

**Endpoint:** `PATCH /users/me`

**Request body (all fields optional):**
```json
{
  "fullName": "Jane Doe",
  "username": "janedoe",
  "picture": "https://example.com/avatar.jpg"
}
```

**What to change in `app/onboarding/page.tsx`:**

Replace `MockApi.saveOnboarding(...)` calls:

```ts
// Step 1 — save username + niche
const completeStep1 = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  await apiRequest("/users/me", {
    method: "PATCH",
    body: JSON.stringify({ username }),
  });
  // niche is a local UI concept — store in your own DB field or skip
  setUser({ ...user!, onboardingStep: 2, profile: { ...user!.profile, username, niche } });
  setLoading(false);
};
```

**UI update needed:** The `niche` / creator type field is not in the backend's `UpdateUserDto`. You have two options:
- Store it client-side only (acceptable for MVP)
- Ask the backend team to add a `niche` field to `UpdateUserDto`

### 2.3 Change password

**Endpoint:** `PATCH /users/me/password`

**Request body:**
```json
{
  "oldPassword": "oldpassword123",
  "newPassword": "newpassword456"
}
```

**UI update needed:** There is no password change UI in the current codebase. Add a settings page or modal with two password fields and call this endpoint.

### 2.4 Delete account

**Endpoint:** `DELETE /users/me`

**UI update needed:** Add a "Delete Account" button in a settings/profile page. Show a confirmation dialog before calling this — it is irreversible.

---

## Step 3 — Videos (Upload & URL Submission)

### 3.1 Submit a URL for AI clip generation

**Endpoint:** `POST /videos/from-url`

**Request body:**
```json
{
  "url": "https://youtube.com/watch?v=abc123",
  "title": "My Video Title",
  "description": "Optional description",
  "targetPlatforms": ["tiktok", "instagram"],
  "style": "viral"
}
```

Valid `style` values: `viral` | `comedy` | `funny` | `normal`

**Response:** `201` with the created video object including its `id`.

**What to change in `components/clips/CreateClipsForm.tsx`:**

The "Fetch Video" button currently does nothing. Wire it up:

```ts
const handleFetchUrl = async () => {
  if (!urlValue.trim()) return;
  setLoading(true);
  try {
    const video = await apiRequest<{ id: number }>("/videos/from-url", {
      method: "POST",
      body: JSON.stringify({
        url: urlValue.trim(),
        targetPlatforms: [activePlatform.toLowerCase()],
        style: "viral",
      }),
    });
    // Navigate to processing page with the video ID
    router.push(`/dashboard/processing?videoId=${video.id}`);
  } catch (err) {
    setError("Failed to submit URL. Please try again.");
  } finally {
    setLoading(false);
  }
};
```

### 3.2 Upload a video file

**Endpoint:** `POST /videos` (multipart/form-data)

**Form fields:**
- `file` — the video file (mp4, mov, avi, webm, mpeg, max 2 GB)
- `title` — string
- `description` — string (optional)
- `sourceType` — `"upload"`
- `style` — `"viral"` | `"comedy"` | `"funny"` | `"normal"`

**What to change in `components/clips/CreateClipsForm.tsx`:**

The "Generate Clips" button currently just navigates to `/dashboard/processing`. Replace with a real upload:

```ts
const handleGenerate = async () => {
  if (!selectedFile) return;
  setLoading(true);
  try {
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", selectedFile.name);
    formData.append("sourceType", "upload");
    formData.append("style", "viral");

    const video = await fetch(`${BASE_URL}/videos`, {
      method: "POST",
      credentials: "include",
      body: formData,
      // Do NOT set Content-Type — browser sets it with the boundary automatically
    }).then(r => r.json());

    router.push(`/dashboard/processing?videoId=${video.id}`);
  } catch (err) {
    setError("Upload failed. Please try again.");
  } finally {
    setLoading(false);
  }
};
```

> Note: Do not pass `Content-Type: application/json` for multipart uploads. Let the browser set it.

### 3.3 List all videos

**Endpoint:** `GET /videos?page=1&limit=20`

**Response:**
```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

**What to change in `lib/queries.ts`:**

Replace `getDashboardData` mock with a real call:

```ts
export const getDashboardData = async () => {
  const [videos, user] = await Promise.all([
    apiRequest<{ data: any[]; total: number }>("/videos?page=1&limit=10"),
    apiRequest<any>("/users/me"),
  ]);

  return {
    stats: {
      clips: String(videos.total),
      platforms: "—", // fetch from /platforms
    },
    projects: videos.data.map(v => ({
      id: v.id,
      title: v.title,
      clipsCount: v.clips?.length ?? 0,
      status: v.status,
      thumbnail: v.thumbnail ?? null,
    })),
  };
};
```

### 3.4 Get a single video with its clips

**Endpoint:** `GET /videos/:id`

**Response:** Video object with a `clips` array.

Use this on the projects/clips detail page to load a specific video's generated clips.

### 3.5 Delete a video

**Endpoint:** `DELETE /videos/:id`

Deletes the video and all its associated clips.

---

## Step 4 — Real-Time Progress (SSE)

The backend streams progress events over Server-Sent Events. There are two streams:

| Stream | Endpoint |
|--------|----------|
| Upload progress | `GET /events/upload-progress/:userId/:videoId` |
| AI processing progress | `GET /events/processing-progress/:videoId` |

Each event is a JSON object:
```json
{ "progress": 45, "status": "uploading", "message": "Uploading to Cloudinary..." }
```

For processing events, a `clips` array is included when complete:
```json
{ "progress": 100, "status": "done", "clips": [...] }
```

### 4.1 Connect to the SSE stream

**What to change in `app/dashboard/processing/page.tsx`:**

Replace the fake `setTimeout` progress animation with a real SSE connection:

```ts
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ProcessingPage() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("videoId");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Starting AI analysis...");
  const [clips, setClips] = useState<any[]>([]);

  useEffect(() => {
    if (!videoId) return;

    const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://clipcash-api.onrender.com";
    const es = new EventSource(
      `${BASE_URL}/events/processing-progress/${videoId}`,
      { withCredentials: true } // sends the auth cookie
    );

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress ?? 0);
      setStatusMessage(data.message ?? "Processing...");

      if (data.status === "done" && data.clips) {
        setClips(data.clips);
        es.close();
        // Navigate to the clips/projects page
        router.push(`/projects?videoId=${videoId}`);
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [videoId]);

  // ... rest of the component using `progress` and `statusMessage`
}
```

**UI update needed:** Pass `?videoId=` in the URL when navigating to `/dashboard/processing` (already shown in Step 3.1 and 3.2 above). The processing page needs to read this param and open the SSE stream.

---

## Step 5 — Clips

### 5.1 List all clips (paginated)

**Endpoint:** `GET /clips?page=1&limit=20`

**What to change in `lib/queries.ts`:**

Replace `getProjectsData` mock:

```ts
export const getProjectsData = async (videoId?: number) => {
  const url = videoId
    ? `/videos/${videoId}/clips`
    : "/clips?page=1&limit=50";

  const data = await apiRequest<any>(url);
  const clips = Array.isArray(data) ? data : data.data ?? [];

  return clips.map((clip: any) => ({
    id: String(clip.id),
    title: clip.title ?? `Clip #${clip.id}`,
    thumbnail: clip.thumbnail ?? "",
    score: clip.viralScore ?? 0,
    scoreKey: clip.viralScore >= 80 ? "high" : clip.viralScore >= 50 ? "medium" : "low",
    duration: formatDuration(clip.duration),
    style: clip.platform ?? "General",
    clipUrl: clip.clipUrl,
  }));
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
```

### 5.2 Get a single clip

**Endpoint:** `GET /clips/:id`

### 5.3 Update a clip

**Endpoint:** `PATCH /clips/:id`

**Request body (all optional):**
```json
{
  "title": "Updated clip title",
  "caption": "New caption #viral",
  "startTime": 10,
  "endTime": 40,
  "duration": 30,
  "audioOverlayUrl": "https://example.com/viral-sound.mp3",
  "platform": "instagram"
}
```

Use this when the user edits a clip's trim points or adds a viral sound overlay.

### 5.4 Delete a clip

**Endpoint:** `DELETE /clips/:id`

**What to change in `components/projects/SelectionFooter.tsx`:**

Wire the delete/export buttons to real API calls using the selected clip IDs.

### 5.5 Create a custom clip

**Endpoint:** `POST /clips`

**Request body:**
```json
{
  "videoId": 1,
  "clipUrl": "https://res.cloudinary.com/example/clip.mp4",
  "thumbnail": "https://res.cloudinary.com/example/thumb.jpg",
  "title": "Funny moment at 2:30",
  "caption": "Check this out! #fyp",
  "startTime": 30.5,
  "endTime": 60,
  "duration": 30,
  "audioOverlayUrl": "https://example.com/viral-sound.mp3",
  "platform": "tiktok"
}
```

---

## Step 6 — Social Platforms

### 6.1 Get connected platforms

**Endpoint:** `GET /platforms`

**Response:**
```json
{
  "success": true,
  "connected": true,
  "platforms": ["TIKTOK", "INSTAGRAM"],
  "accountCount": 2
}
```

**What to change in `components/platforms/PlatformsContent.tsx`:**

Replace the hardcoded platform statuses with real data:

```ts
"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";

export default function PlatformsContent() {
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    apiRequest<{ platforms: string[] }>("/platforms")
      .then(data => setConnectedPlatforms(data.platforms))
      .catch(() => {});
  }, []);

  const isConnected = (name: string) =>
    connectedPlatforms.includes(name.toUpperCase());

  // Pass isConnected(platform.name) to each PlatformCard's status prop
}
```

### 6.2 Connect a social platform (OAuth)

**Endpoint:** `GET /platforms/connect/:platform`

Supported platform values: `tiktok`, `instagram`, `youtube`, `facebook`, `linkedin`, `linkedin_pages`, `pinterest`, `x`

**Step-by-step flow:**

1. User clicks "Connect Account" on a platform card
2. Call `GET /platforms/connect/tiktok` to get the OAuth URL
3. Open that URL in the browser (redirect or popup)
4. WoopSocial handles the OAuth and redirects back to your frontend with query params
5. Your frontend callback page calls `POST /platforms/callback` with those params
6. Platform is now connected

**What to change in `components/platforms/PlatformCard.tsx`:**

```ts
const handleConnect = async (platformName: string) => {
  try {
    const { url } = await apiRequest<{ url: string }>(
      `/platforms/connect/${platformName.toLowerCase()}`
    );
    window.location.href = url; // redirect to OAuth
  } catch (err) {
    console.error("Failed to get OAuth URL", err);
  }
};
```

**UI update needed — OAuth callback page:**

Create `app/platforms/callback/page.tsx` to handle the redirect from WoopSocial:

```tsx
"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";

export default function PlatformCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const status = searchParams.get("status") ?? "error";
    const projectId = searchParams.get("projectId") ?? "";
    const platform = searchParams.get("platform") ?? "";
    const socialAccountIds = searchParams.get("socialAccountIds") ?? "";
    const error = searchParams.get("error") ?? undefined;

    apiRequest("/platforms/callback", {
      method: "POST",
      body: JSON.stringify({ status, projectId, platform, socialAccountIds, error }),
    })
      .then(() => router.push("/platforms?connected=true"))
      .catch(() => router.push("/platforms?error=true"));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-white">
      <p>Connecting your account...</p>
    </div>
  );
}
```

### 6.3 Disconnect a platform

**Endpoint:** `DELETE /platforms/:platform`

```ts
await apiRequest(`/platforms/${platformName.toLowerCase()}`, { method: "DELETE" });
```

### 6.4 Post a clip to social platforms

**Endpoint:** `POST /platforms/post-clip`

**Request body:**
```json
{
  "clipId": 1,
  "platforms": ["tiktok", "instagram"]
}
```

**What to change in `components/projects/SelectionFooter.tsx`:**

Wire the "Post" / "Publish" button:

```ts
const handlePost = async () => {
  for (const clipId of selectedIds) {
    await apiRequest("/platforms/post-clip", {
      method: "POST",
      body: JSON.stringify({
        clipId: Number(clipId),
        platforms: ["tiktok"], // or let user pick
      }),
    });
  }
};
```

---

## Step 7 — Dashboard Stats (Putting It Together)

The dashboard currently shows hardcoded stats. Here is how to build real stats from the available APIs:

```ts
// lib/queries.ts
export const getDashboardData = async () => {
  const [videosRes, platformsRes] = await Promise.all([
    apiRequest<{ data: any[]; total: number }>("/videos?page=1&limit=10"),
    apiRequest<{ platforms: string[]; accountCount: number }>("/platforms"),
  ]);

  // Count total clips across all videos
  const totalClips = videosRes.data.reduce(
    (sum: number, v: any) => sum + (v.clips?.length ?? 0),
    0
  );

  return {
    stats: {
      clips: String(totalClips),
      platforms: String(platformsRes.accountCount),
    },
    projects: videosRes.data.map((v: any) => ({
      id: v.id,
      title: v.title,
      clipsCount: v.clips?.length ?? 0,
      status: v.status,
      thumbnail: v.thumbnail ?? null,
    })),
  };
};
```

---

## Step 8 — Onboarding Social Connect (Step 2)

The current `SocialConnectStep` component calls `onComplete()` when any platform button is clicked, which is purely cosmetic. Replace with a real OAuth connect:

**What to change in `components/onboarding/SocialConnectStep.tsx`:**

```ts
const handleConnect = async (platformName: string) => {
  try {
    const { url } = await apiRequest<{ url: string }>(
      `/platforms/connect/${platformName.toLowerCase()}`
    );
    window.location.href = url;
  } catch {
    // fallback — let user skip
    onComplete();
  }
};

// In the JSX, replace onClick={onComplete} with onClick={() => handleConnect(platform.name)}
```

The "Skip for now" button can still call `onComplete()` directly.

---

## Summary of All UI Changes Needed

| Location | What to add / change |
|---|---|
| `components/AuthForm.tsx` | Replace `MockApi.login` and `MockApi.signup` with real API calls |
| `components/AuthProvider.tsx` | Replace cookie restore with `GET /users/me`; update `logout` to call `POST /auths/logout` |
| `app/onboarding/page.tsx` | Replace `MockApi.saveOnboarding` with `PATCH /users/me` |
| `components/onboarding/SocialConnectStep.tsx` | Wire platform buttons to `GET /platforms/connect/:platform` |
| `components/clips/CreateClipsForm.tsx` | Wire URL fetch to `POST /videos/from-url`; wire file upload to `POST /videos` |
| `app/dashboard/processing/page.tsx` | Read `?videoId` from URL; connect to SSE stream |
| `lib/queries.ts` | Replace all mock data functions with real API calls |
| `components/platforms/PlatformsContent.tsx` | Load connected platforms from `GET /platforms`; wire connect/disconnect buttons |
| `components/platforms/PlatformCard.tsx` | Add `handleConnect` calling `GET /platforms/connect/:platform` |
| `components/projects/SelectionFooter.tsx` | Wire post button to `POST /platforms/post-clip`; wire delete to `DELETE /clips/:id` |
| `app/platforms/callback/page.tsx` | **New file** — handles OAuth redirect, calls `POST /platforms/callback` |
| Settings page (does not exist yet) | **New page** — add password change (`PATCH /users/me/password`) and delete account (`DELETE /users/me`) |

---

## Auth Flow Diagram

```
User fills signup form
        │
        ▼
POST /auths/signup  ──► 201 Created (cookies set)
        │
        ▼
GET /users/me  ──► user object
        │
        ▼
AuthProvider sets user state
        │
        ├── onboardingStep <= 2  ──► /onboarding
        └── onboardingStep > 2   ──► /dashboard
```

```
User clicks "Continue with Google"
        │
        ▼
window.location.href = /auths/google
        │
        ▼
Google OAuth flow (handled by backend)
        │
        ▼
Backend redirects to /dashboard (cookies set)
        │
        ▼
AuthProvider calls GET /users/me on mount
        │
        ▼
User state hydrated
```

---

## Video → Clips Flow Diagram

```
User pastes URL or uploads file
        │
        ├── URL  ──► POST /videos/from-url  ──► { id: videoId }
        └── File ──► POST /videos (multipart) ──► { id: videoId }
                │
                ▼
        Navigate to /dashboard/processing?videoId=<id>
                │
                ▼
        EventSource /events/processing-progress/:videoId
                │
                ├── progress events ──► update progress bar
                └── status: "done"  ──► navigate to /projects?videoId=<id>
                                                │
                                                ▼
                                        GET /videos/:id/clips
                                                │
                                                ▼
                                        Render ClipGrid
```

---

## Error Handling Conventions

| HTTP Status | Meaning | What to show |
|---|---|---|
| `400` | Bad request / validation error | Show the `message` field from the response body |
| `401` | Not authenticated | Redirect to `/login` |
| `403` | Forbidden (wrong user) | Show "Access denied" toast |
| `404` | Resource not found | Show empty state |
| `409` | Conflict (e.g. email already exists) | Show inline form error |
| `429` | Rate limited | Show "Too many requests, please wait" |
| `5xx` | Server error | Show generic error toast |

---

## Rate Limits

| Endpoint | Limit |
|---|---|
| `POST /videos` (file upload) | 3 uploads / minute |
| `POST /videos/from-url` | 5 URL submissions / minute |

Show a user-friendly message when a `429` is returned.

---

## Removing the Mock API

Once all real API calls are wired up:

1. Delete `app/lib/mockApi.ts`
2. Remove all `import { MockApi }` references
3. Remove the `Cookies.set("clipcash_user", ...)` calls from `AuthProvider` — the backend cookie is the session now
4. The `clipcash_user` cookie was only needed for the mock in-memory DB recovery — it is no longer needed
