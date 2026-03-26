# Form Submission Implementation

## Overview
This document describes the implementation of the "Generate Clips" form submission feature, connecting all form inputs to the AI engine backend.

## Components Created

### 1. `/app/create/page.tsx`
Main form page with complete submission logic.

**Features:**
- Video input via URL or file upload (mutually exclusive)
- Platform selection (TikTok, Instagram, YouTube)
- Auto-publish toggle
- Form validation
- Loading states with spinner
- Error handling
- Integration with process tracking store

**Validation Rules:**
- Either URL OR file must be provided (not both)
- At least one platform must be selected
- Button is disabled during submission to prevent multiple requests

**State Management:**
- Uses `useProcessStore` to track job progress
- Redirects to dashboard after successful submission
- Persists job state in localStorage

### 2. `/app/api/clips/generate/route.ts`
Next.js API route handler for form submission.

**Responsibilities:**
- Receives FormData from client
- Validates input data
- Forwards request to backend API
- Returns job ID for tracking
- Handles errors gracefully

**API Contract:**

**Request:**
```typescript
FormData {
  video?: File              // Video file (if uploaded)
  videoUrl?: string         // Video URL (if provided)
  platforms: string         // JSON array of platform IDs
  autoPublish: string       // "true" or "false"
}
```

**Response (Success):**
```json
{
  "success": true,
  "jobId": "uuid-string",
  "message": "Clip generation started successfully"
}
```

**Response (Error):**
```json
{
  "message": "Error description"
}
```

## User Flow

1. User navigates to `/create` page
2. User provides video source:
   - Paste URL in text input, OR
   - Upload file via drag-drop or file picker
3. User selects target platforms (at least one required)
4. User optionally enables auto-publish toggle
5. User clicks "Generate Clips" button
6. Button shows loading spinner and disables
7. Form data is sent to `/api/clips/generate`
8. API forwards to backend service
9. On success:
   - Job tracking starts via `useProcessStore`
   - User is redirected to `/dashboard`
   - Process dashboard shows real-time progress
10. On error:
    - Error message displays below form
    - Button re-enables for retry

## Integration Points

### Process Store
```typescript
import { useProcessStore } from "../hooks/useProcessStore";

const { startProcess } = useProcessStore();

// After successful submission
startProcess(jobId, jobLabel);
```

### WebSocket Updates
The existing `ProcessDashboard` component automatically connects to WebSocket for real-time progress updates when a job is active.

### Backend API
Expected backend endpoint: `POST /api/clips/generate`

Backend should accept:
- `video` (multipart file) OR `videoUrl` (string)
- `platforms` (JSON array)
- `autoPublish` (boolean)

Backend should return:
- `jobId` or `id` (string) - unique job identifier
- Additional metadata as needed

## Environment Variables

Add to `.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/progress
```

## Installation

Install new dependencies:
```bash
cd clips-frontend
npm install
```

This will install:
- `lucide-react` - Icon library for UI elements
- `zustand` - State management (if not already installed)

## Testing Checklist

- [ ] Form validates URL input correctly
- [ ] Form validates file upload correctly
- [ ] URL and file upload are mutually exclusive
- [ ] Platform selection toggles work
- [ ] Auto-publish toggle works
- [ ] Button is disabled when form is invalid
- [ ] Button shows loading state during submission
- [ ] Multiple submissions are prevented
- [ ] Error messages display correctly
- [ ] Successful submission redirects to dashboard
- [ ] Job tracking starts after submission
- [ ] Process dashboard shows progress updates

## Acceptance Criteria Status

✅ Implemented primary "Generate Clips" button with sparkles icon
✅ Added loading/spinner state to button after clicking
✅ Logic ensures either URL OR file is provided before enabling
✅ Clicking button sends combined data (Video + Platforms + Toggle) to backend
✅ Multiple submissions prevented while request is pending

## Future Enhancements

- File size validation before upload
- Video format validation
- Preview uploaded video
- Save draft functionality
- Batch upload support
- Custom clip duration settings
- Advanced platform-specific options
