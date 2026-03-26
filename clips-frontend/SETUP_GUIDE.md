# Setup Guide - Form Submission Feature

## Quick Start

### 1. Install Dependencies
```bash
cd clips-frontend
npm install
```

This will install the new dependencies added to `package.json`:
- `lucide-react` - Icon library
- `zustand` - State management (if needed)

### 2. Configure Environment Variables

Create or update `.env.local` in the `clips-frontend` directory:

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# WebSocket URL for real-time progress updates
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/progress
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 4. Test the Feature

1. Navigate to `http://localhost:3000/create`
2. Try the form:
   - Enter a video URL OR upload a file
   - Select at least one platform
   - Toggle auto-publish if desired
   - Click "Generate Clips"

## Backend Requirements

The backend API must implement the following endpoint:

### `POST /api/clips/generate`

**Request Format:** `multipart/form-data`

**Fields:**
- `video` (File, optional) - Uploaded video file
- `videoUrl` (string, optional) - Video URL
- `platforms` (string) - JSON array of platform IDs: `["tiktok", "instagram", "youtube"]`
- `autoPublish` (string) - `"true"` or `"false"`

**Response Format:** `application/json`

```json
{
  "jobId": "unique-job-identifier",
  "status": "processing",
  "message": "Job created successfully"
}
```

**Error Response:**
```json
{
  "message": "Error description"
}
```

### WebSocket Endpoint

The existing `useWebSocket` hook expects: `ws://localhost:8000/ws/progress`

**Message Format:**
```typescript
// Progress update
{
  "type": "progress",
  "progress": 45,
  "momentsFound": 12,
  "estimatedSecondsRemaining": 120
}

// Completion
{
  "type": "complete",
  "momentsFound": 15
}

// Error
{
  "type": "error",
  "message": "Error description"
}
```

## File Structure

```
clips-frontend/
├── app/
│   ├── create/
│   │   └── page.tsx              # Main form page
│   ├── api/
│   │   └── clips/
│   │       └── generate/
│   │           └── route.ts      # API route handler
│   └── hooks/
│       ├── useProcessStore.ts    # Job state management
│       ├── useWebSocket.ts       # WebSocket connection
│       └── useNotifications.ts   # Browser notifications
├── FORM_SUBMISSION_IMPLEMENTATION.md
└── SETUP_GUIDE.md
```

## Troubleshooting

### TypeScript Errors
If you see TypeScript errors after creating files, run:
```bash
npm install
```

### Port Conflicts
If port 3000 is in use:
```bash
npm run dev -- -p 3001
```

### Backend Connection Issues
1. Verify backend is running
2. Check `NEXT_PUBLIC_API_URL` in `.env.local`
3. Check browser console for CORS errors
4. Verify backend endpoint matches `/api/clips/generate`

### WebSocket Connection Issues
1. Verify WebSocket server is running
2. Check `NEXT_PUBLIC_WS_URL` in `.env.local`
3. Check browser console for connection errors
4. Ensure WebSocket endpoint is `/ws/progress`

## Next Steps

After setup:
1. Test form validation
2. Test file upload
3. Test URL input
4. Verify backend integration
5. Test progress tracking on dashboard
6. Test error handling
7. Test browser notifications

## Development Tips

### Testing Without Backend
You can mock the API response by modifying `route.ts`:

```typescript
// Mock response for testing
return NextResponse.json({
  success: true,
  jobId: crypto.randomUUID(),
  message: "Clip generation started successfully",
});
```

### Debugging Form State
Add console logs in `page.tsx`:

```typescript
console.log({
  hasVideoInput,
  hasSelectedPlatform,
  isFormValid,
  platforms,
});
```

### Testing WebSocket
Use browser DevTools > Network > WS to monitor WebSocket messages.
