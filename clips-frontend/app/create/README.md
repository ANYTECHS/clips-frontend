# Create Clips Page

## Quick Start

This page allows users to generate AI-powered clips from their videos.

### Usage

1. Navigate to `/create`
2. Provide a video:
   - Enter a video URL (YouTube, etc.), OR
   - Upload a video file
3. Select target platforms (TikTok, Instagram, YouTube)
4. Click "Generate Clips" button

### Form Validation

The "Generate Clips" button is only enabled when:
- A video source is provided (URL or file)
- At least one platform is selected

### API Integration

The form submits to `POST /api/generate-clips` with:
- Video file or URL
- Array of selected platform names

### Environment Setup

Set the API URL in your `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Component Architecture

```
CreatePage
├── Video Input Section
│   ├── URL Input
│   └── File Upload
├── Platform Selection
│   └── SocialAccountCardGrid
│       └── SocialAccountCard (x3)
└── Submit Button
    ├── Sparkles Icon
    └── Loading Spinner
```

### State Management

```typescript
{
  videoUrl: string,
  videoFile: File | null,
  selectedPlatforms: Set<string>,
  isSubmitting: boolean,
  error: string | null
}
```

### Error Handling

Errors are displayed above the submit button in a red alert box. The form remains editable and can be resubmitted after fixing issues.
