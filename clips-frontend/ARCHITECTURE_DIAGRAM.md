# Architecture Diagram - Form Submission Flow

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│                      /create (Form Page)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ User Input
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Form State Management                      │
│  • videoUrl / uploadedFile                                      │
│  • platforms (array)                                            │
│  • autoPublish (boolean)                                        │
│  • isSubmitting (boolean)                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Validation
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Validation Logic                           │
│  hasVideoInput = url OR file                                    │
│  hasSelectedPlatform = at least one platform                    │
│  isFormValid = hasVideoInput AND hasSelectedPlatform            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Submit (if valid)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Route                            │
│              /api/clips/generate/route.ts                       │
│  • Receives FormData                                            │
│  • Validates input                                              │
│  • Forwards to backend                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP POST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API                                │
│              POST /api/clips/generate                           │
│  • Processes video                                              │
│  • Creates job                                                  │
│  • Returns jobId                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Response (jobId)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Process Store                                │
│              useProcessStore Hook                               │
│  • startProcess(jobId, label)                                   │
│  • Saves to localStorage                                        │
│  • Updates state                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Navigate
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Dashboard                                  │
│              /dashboard (Process View)                          │
│  • Shows job progress                                           │
│  • Connects to WebSocket                                        │
│  • Displays real-time updates                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket Connection
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WebSocket Server                             │
│              ws://backend/ws/progress                           │
│  • Sends progress updates                                       │
│  • Sends completion notification                                │
│  • Sends error messages                                         │
└─────────────────────────────────────────────────────────────────┘
```

## Component Interaction Flow

```
┌──────────────┐
│   User       │
└──────┬───────┘
       │
       │ 1. Enters URL or uploads file
       │ 2. Selects platforms
       │ 3. Toggles auto-publish
       │ 4. Clicks "Generate Clips"
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  CreateClipsPage Component                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  State:                                                │  │
│  │  • videoUrl: string                                    │  │
│  │  • uploadedFile: File | null                           │  │
│  │  • platforms: PlatformState[]                          │  │
│  │  • autoPublish: boolean                                │  │
│  │  • isSubmitting: boolean                               │  │
│  │  • error: string | null                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Validation:                                           │  │
│  │  const hasVideoInput = videoUrl || uploadedFile        │  │
│  │  const hasSelectedPlatform = platforms.some(p.enabled) │  │
│  │  const isFormValid = hasVideoInput &&                  │  │
│  │                      hasSelectedPlatform &&            │  │
│  │                      !isSubmitting                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  handleSubmit():                                       │  │
│  │  1. Prevent default                                    │  │
│  │  2. Set isSubmitting = true                            │  │
│  │  3. Create FormData                                    │  │
│  │  4. POST to /api/clips/generate                        │  │
│  │  5. Handle response                                    │  │
│  │  6. Start process tracking                             │  │
│  │  7. Navigate to dashboard                              │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
       │
       │ POST FormData
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  API Route: /api/clips/generate/route.ts                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  1. Extract FormData                                   │  │
│  │  2. Validate inputs                                    │  │
│  │  3. Forward to backend API                             │  │
│  │  4. Return response                                    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
       │
       │ Response { jobId }
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  useProcessStore Hook                                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  startProcess(jobId, label):                           │  │
│  │  1. Create ProcessState                                │  │
│  │  2. Save to localStorage                               │  │
│  │  3. Update React state                                 │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
       │
       │ Navigate
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  ProcessDashboard Component                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  • Reads process state                                 │  │
│  │  • Connects to WebSocket                               │  │
│  │  • Displays progress bar                               │  │
│  │  • Shows real-time updates                             │  │
│  │  • Sends notifications                                 │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────┐
│   Form      │
│   Inputs    │
└──────┬──────┘
       │
       │ { videoUrl, uploadedFile, platforms, autoPublish }
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│                    FormData                             │
│  ┌───────────────────────────────────────────────────┐  │
│  │  video: File (if uploaded)                        │  │
│  │  videoUrl: string (if provided)                   │  │
│  │  platforms: JSON string ["tiktok", "instagram"]   │  │
│  │  autoPublish: "true" | "false"                    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
       │
       │ POST /api/clips/generate
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│              Backend Processing                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  1. Validate video source                         │  │
│  │  2. Create job in database                        │  │
│  │  3. Queue for processing                          │  │
│  │  4. Return job metadata                           │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
       │
       │ { jobId, status, message }
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│                  ProcessState                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  id: jobId                                        │  │
│  │  label: "video.mp4"                               │  │
│  │  progress: 0                                      │  │
│  │  status: "processing"                             │  │
│  │  startedAt: timestamp                             │  │
│  │  momentsFound: 0                                  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
       │
       │ Stored in localStorage
       │ Displayed on dashboard
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│              WebSocket Updates                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  { type: "progress", progress: 45, ... }          │  │
│  │  { type: "complete", momentsFound: 15 }           │  │
│  │  { type: "error", message: "..." }                │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## State Machine Diagram

```
┌─────────┐
│  IDLE   │ ◄─── Initial state
└────┬────┘
     │
     │ User fills form
     │
     ▼
┌─────────────┐
│  VALIDATING │
└────┬────────┘
     │
     ├─── Invalid ──► Button disabled
     │
     └─── Valid ──► Button enabled
                    │
                    │ User clicks submit
                    │
                    ▼
              ┌──────────────┐
              │  SUBMITTING  │
              └──────┬───────┘
                     │
                     ├─── Success ──► Navigate to dashboard
                     │                │
                     │                ▼
                     │          ┌────────────┐
                     │          │ PROCESSING │
                     │          └─────┬──────┘
                     │                │
                     │                ├─── Progress updates
                     │                │
                     │                └─── Complete ──► COMPLETE
                     │
                     └─── Error ──► Show error, return to VALIDATING
```

## Error Handling Flow

```
┌──────────────────┐
│  Form Submission │
└────────┬─────────┘
         │
         ▼
    ┌────────┐
    │ Valid? │
    └───┬────┘
        │
        ├─── No ──► Show validation hint
        │
        └─── Yes ──► Submit
                     │
                     ▼
                ┌─────────┐
                │ Network │
                │ Request │
                └────┬────┘
                     │
                     ├─── Network Error ──► Show error message
                     │                      Re-enable form
                     │
                     ├─── 4xx Error ──► Show error message
                     │                  Re-enable form
                     │
                     ├─── 5xx Error ──► Show error message
                     │                  Re-enable form
                     │
                     └─── Success ──► Navigate to dashboard
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Application                     │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Create Page  │  │ API Routes   │  │ Process Store   │  │
│  │ /create      │──│ /api/clips/  │──│ useProcessStore │  │
│  │              │  │ generate     │  │                 │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
│         │                  │                   │           │
└─────────┼──────────────────┼───────────────────┼───────────┘
          │                  │                   │
          │                  │                   │
          ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend Services                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ REST API     │  │ WebSocket    │  │ Job Queue       │  │
│  │ /api/clips/  │  │ /ws/progress │  │ Processing      │  │
│  │ generate     │  │              │  │                 │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Stack                         │
├─────────────────────────────────────────────────────────────┤
│  Framework:      Next.js 16 (App Router)                    │
│  Language:       TypeScript                                 │
│  Styling:        Tailwind CSS 4                             │
│  Icons:          Lucide React                               │
│  State:          React Hooks + Zustand                      │
│  Testing:        Vitest + Testing Library                   │
│  Real-time:      WebSocket API                              │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
clips-frontend/
├── app/
│   ├── create/
│   │   ├── page.tsx                    # Main form component
│   │   └── __tests__/
│   │       └── page.test.tsx           # Unit tests
│   │
│   ├── api/
│   │   └── clips/
│   │       └── generate/
│   │           └── route.ts            # API route handler
│   │
│   ├── hooks/
│   │   ├── useProcessStore.ts          # Job state management
│   │   ├── useWebSocket.ts             # WebSocket connection
│   │   └── useNotifications.ts         # Browser notifications
│   │
│   └── components/
│       └── ProcessDashboard.tsx        # Progress display
│
└── docs/
    ├── FEATURE_SUMMARY.md
    ├── SETUP_GUIDE.md
    ├── FORM_SUBMISSION_IMPLEMENTATION.md
    ├── QUICK_REFERENCE.md
    └── ARCHITECTURE_DIAGRAM.md         # This file
```
