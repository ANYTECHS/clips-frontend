# ClipCash - AI Clipping Platform

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## API Endpoints

### Upload Video
`POST /api/upload`

Uploads video files for AI processing.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `files`: Video file(s) (max 500MB per file)
  - Supported formats: MP4, MOV, AVI, MKV

**Response:**
```json
{
  "success": true,
  "message": "Successfully uploaded 1 file(s)",
  "jobId": "job_1234567890_abc123xyz",
  "files": [
    {
      "name": "video.mp4",
      "size": 104857600,
      "type": "video/mp4"
    }
  ]
}
```

**Error Response:**
```json
{
  "error": "File exceeds maximum size of 500MB"
}
```

### Check Job Status
`GET /api/jobs/:jobId`

Poll this endpoint to get real-time processing status updates.

**Response:**
```json
{
  "progress": 45,
  "status": "processing",
  "momentsFound": 3,
  "estimatedSecondsRemaining": 120
}
```

**Status Values:**
- `processing`: Job is actively being processed
- `complete`: Processing finished successfully
- `error`: Processing failed

## Features

### Real-Time Processing Progress
The `/dashboard/processing` page uses a polling mechanism (every 3 seconds) to fetch real-time job status from the backend via the `useProcessingStatus` hook.

### Push Notifications
When a processing job completes, users receive browser push notifications (if permission granted). Notification preferences are persisted to localStorage.

- Permission request happens on first upload
- Clicking notification navigates to `/projects` page
- Works with service worker for background notifications
- Users can manage preferences in settings

### SEO Optimization
- `app/robots.ts`: Disallows crawling of authenticated routes
- `app/sitemap.ts`: Includes only public marketing pages
- Public routes: `/`, `/login`, `/privacy`, `/terms`, `/status`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
