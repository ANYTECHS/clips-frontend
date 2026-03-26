# API Integration Guide for Generate Clips Feature

## Overview
This document describes the API contract expected by the frontend `/create` page for the clip generation feature.

## Endpoint

```
POST /api/generate-clips
```

## Request

### Headers
```
Content-Type: multipart/form-data
```

### Body Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `video` | File | Conditional* | Video file uploaded by user |
| `videoUrl` | string | Conditional* | URL to video (YouTube, etc.) |
| `platforms` | string | Yes | JSON array of platform names |

*Either `video` OR `videoUrl` must be provided, but not both.

### Example Request (File Upload)

```javascript
const formData = new FormData();
formData.append("video", videoFile); // File object
formData.append("platforms", JSON.stringify(["tiktok", "youtube", "instagram"]));

fetch("http://localhost:8000/api/generate-clips", {
  method: "POST",
  body: formData
});
```

### Example Request (URL)

```javascript
const formData = new FormData();
formData.append("videoUrl", "https://youtube.com/watch?v=dQw4w9WgXcQ");
formData.append("platforms", JSON.stringify(["tiktok", "instagram"]));

fetch("http://localhost:8000/api/generate-clips", {
  method: "POST",
  body: formData
});
```

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "jobId": "job_abc123xyz",
  "message": "Clip generation started",
  "estimatedTime": 120
}
```

### Error Response (4xx/5xx)

```json
{
  "success": false,
  "message": "Error message describing what went wrong",
  "code": "INVALID_VIDEO_FORMAT"
}
```

## Platform Values

The `platforms` field will contain an array with one or more of these values:

- `"tiktok"`
- `"instagram"`
- `"youtube"`

Example:
```json
["tiktok", "youtube"]
```

## Validation Rules

### Backend Should Validate:

1. **Video Source**
   - Exactly one of `video` or `videoUrl` must be provided
   - If `video`: Check file size, format, duration
   - If `videoUrl`: Validate URL format and accessibility

2. **Platforms**
   - Must be valid JSON array
   - Must contain at least one platform
   - Platform names must be valid (tiktok, instagram, youtube)

3. **File Constraints** (if applicable)
   - Max file size: 500MB (recommended)
   - Supported formats: mp4, mov, avi, webm
   - Max duration: 60 minutes (recommended)

## Error Codes

Suggested error codes for consistent error handling:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `MISSING_VIDEO_SOURCE` | 400 | Neither video file nor URL provided |
| `INVALID_VIDEO_FORMAT` | 400 | Unsupported video format |
| `VIDEO_TOO_LARGE` | 413 | File size exceeds limit |
| `INVALID_URL` | 400 | Video URL is invalid or inaccessible |
| `NO_PLATFORMS_SELECTED` | 400 | Platforms array is empty |
| `INVALID_PLATFORM` | 400 | Unknown platform name provided |
| `PROCESSING_ERROR` | 500 | Internal error during processing |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

## Frontend Behavior

### On Success (200 OK)
- Frontend redirects to `/dashboard`
- User can view processing status there

### On Error (4xx/5xx)
- Frontend displays error message from `message` field
- Form remains editable
- User can correct and resubmit

### During Submission
- Submit button shows loading spinner
- All form inputs are disabled
- Multiple submissions are prevented

## Testing the Integration

### Using cURL

```bash
# Test with URL
curl -X POST http://localhost:8000/api/generate-clips \
  -F "videoUrl=https://youtube.com/watch?v=dQw4w9WgXcQ" \
  -F 'platforms=["tiktok","youtube"]'

# Test with file
curl -X POST http://localhost:8000/api/generate-clips \
  -F "video=@/path/to/video.mp4" \
  -F 'platforms=["tiktok","instagram"]'
```

### Using Postman

1. Set method to POST
2. URL: `http://localhost:8000/api/generate-clips`
3. Body → form-data
4. Add key `video` (type: File) OR `videoUrl` (type: Text)
5. Add key `platforms` (type: Text) with value: `["tiktok","youtube"]`

## Environment Configuration

Frontend expects this environment variable:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Set in `.env.local` for local development.

## CORS Configuration

Backend must allow requests from frontend origin:

```python
# Example for FastAPI
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## WebSocket Integration (Future)

After job creation, frontend can connect to WebSocket for real-time progress:

```
ws://localhost:8000/ws/progress?jobId={jobId}
```

See `useWebSocket.ts` hook for implementation details.

## Security Considerations

1. **File Upload**
   - Validate file type on server
   - Scan for malware
   - Limit file size
   - Store securely

2. **URL Validation**
   - Validate URL format
   - Check against whitelist of allowed domains
   - Prevent SSRF attacks
   - Timeout for URL fetching

3. **Rate Limiting**
   - Limit requests per user/IP
   - Prevent abuse

4. **Authentication** (if required)
   - Add auth token to request headers
   - Validate user permissions

## Example Backend Implementation (FastAPI)

```python
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from typing import Optional
import json

app = FastAPI()

@app.post("/api/generate-clips")
async def generate_clips(
    video: Optional[UploadFile] = File(None),
    videoUrl: Optional[str] = Form(None),
    platforms: str = Form(...)
):
    # Validate input
    if not video and not videoUrl:
        raise HTTPException(400, detail="Either video file or URL required")
    
    if video and videoUrl:
        raise HTTPException(400, detail="Provide either video file or URL, not both")
    
    # Parse platforms
    try:
        platform_list = json.loads(platforms)
    except:
        raise HTTPException(400, detail="Invalid platforms format")
    
    if not platform_list:
        raise HTTPException(400, detail="At least one platform required")
    
    # Process video
    job_id = create_clip_generation_job(video, videoUrl, platform_list)
    
    return {
        "success": True,
        "jobId": job_id,
        "message": "Clip generation started"
    }
```

## Questions?

Contact the frontend team for clarification on the API contract.
